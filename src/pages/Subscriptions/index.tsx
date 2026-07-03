import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Pause, Play, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import axiosInstance from '@/services/api/axiosInstance'
import { queryKeys } from '@/services/queryKeys'
import type { Subscription, SubscriptionFrequency, SubscriptionStatus } from '@/types'

const FREQ_LABELS: Record<SubscriptionFrequency, string> = {
  weekly: 'Every week',
  biweekly: 'Every 2 weeks',
  monthly: 'Every month',
}

export default function SubscriptionsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.subscriptions.all(),
    queryFn: async () => {
      const res = await axiosInstance.get<{ success: boolean; data: Subscription[] }>('/subscriptions')
      return res.data.data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status?: SubscriptionStatus; frequency?: SubscriptionFrequency }) => {
      await axiosInstance.put(`/subscriptions/${id}`, body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() }),
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.delete(`/subscriptions/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() }),
  })

  const subs = data ?? []

  return (
    <div className="min-h-screen bg-ocean-50 dark:bg-ocean-950 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <RefreshCw size={22} className="text-ocean-600" />
          <h1 className="text-2xl font-bold text-ocean-900 dark:text-ocean-100">Subscriptions</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="animate-pulse h-32 bg-white dark:bg-ocean-900 rounded-2xl" />
            ))}
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-ocean-900 rounded-2xl">
            <RefreshCw size={40} className="mx-auto mb-3 text-ocean-300" />
            <p className="text-ocean-600 dark:text-ocean-400 font-medium">No active subscriptions</p>
            <p className="text-sm text-ocean-400 mt-1">
              Subscribe to products from their product page and save 10%!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {subs.map((sub, i) => {
              const discountedPrice = sub.productPrice * (1 - sub.discountPct / 100)
              const isPaused = sub.status === 'paused'
              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-ocean-900 rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex gap-4">
                    {sub.productImage && (
                      <img
                        src={sub.productImage}
                        alt={sub.productName}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ocean-900 dark:text-ocean-100 truncate">{sub.productName}</p>
                      <p className="text-sm text-ocean-500 mt-0.5">
                        Qty: {sub.quantity} · {FREQ_LABELS[sub.frequency]}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-ocean-900 dark:text-ocean-100">
                          ₹{discountedPrice.toFixed(0)}
                        </span>
                        <span className="text-xs text-ocean-400 line-through">₹{sub.productPrice}</span>
                        <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
                          {sub.discountPct}% off
                        </span>
                      </div>
                      {sub.nextDelivery && (
                        <p className="text-xs text-ocean-400 mt-1">
                          Next delivery: {new Date(sub.nextDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}

                      {/* Status badge */}
                      <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                        isPaused
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {isPaused ? 'Paused' : 'Active'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        title={isPaused ? 'Resume' : 'Pause'}
                        onClick={() => updateMutation.mutate({ id: sub.id, status: isPaused ? 'active' : 'paused' })}
                        disabled={updateMutation.isPending}
                        className="p-2 rounded-lg bg-ocean-100 dark:bg-ocean-800 hover:bg-ocean-200 dark:hover:bg-ocean-700 text-ocean-600 dark:text-ocean-300 transition-colors"
                      >
                        {isPaused ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                      <button
                        title="Cancel subscription"
                        onClick={() => {
                          if (confirm('Cancel this subscription?')) cancelMutation.mutate(sub.id)
                        }}
                        disabled={cancelMutation.isPending}
                        className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Frequency selector */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-ocean-100 dark:border-ocean-800">
                    <span className="text-xs text-ocean-500 self-center">Frequency:</span>
                    {(['weekly', 'biweekly', 'monthly'] as SubscriptionFrequency[]).map(f => (
                      <button
                        key={f}
                        onClick={() => updateMutation.mutate({ id: sub.id, frequency: f })}
                        disabled={updateMutation.isPending}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          sub.frequency === f
                            ? 'bg-ocean-700 text-white border-ocean-700'
                            : 'border-ocean-200 dark:border-ocean-700 text-ocean-600 dark:text-ocean-400 hover:border-ocean-400'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
