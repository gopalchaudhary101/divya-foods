import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, Gift, TrendingUp, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import axiosInstance from '@/services/api/axiosInstance'
import { queryKeys } from '@/services/queryKeys'
import type { LoyaltyBalance } from '@/types'

export default function LoyaltyPage() {
  const [redeemInput, setRedeemInput] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.loyalty.balance(),
    queryFn: async () => {
      const res = await axiosInstance.get<{ success: boolean; data: LoyaltyBalance }>('/loyalty/balance')
      return res.data.data
    },
  })

  const redeemMutation = useMutation({
    mutationFn: async (points: number) => {
      const res = await axiosInstance.post<{ success: boolean; data: { pointsUsed: number; discount: number } }>(
        '/loyalty/redeem',
        { points }
      )
      return res.data.data
    },
    onSuccess: () => {
      setRedeemInput('')
      qc.invalidateQueries({ queryKey: queryKeys.loyalty.balance() })
    },
  })

  const points = Number(redeemInput) || 0

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-ocean-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) return null

  const discountPreview = points > 0 ? (points * data.discountPerPoint).toFixed(2) : null

  return (
    <div className="min-h-screen bg-ocean-50 dark:bg-ocean-950 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-ocean-900 dark:text-ocean-100 flex items-center gap-2">
          <Star className="text-amber-500" size={24} />
          Loyalty Points
        </h1>

        {/* Balance cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Earned', value: data.earned, icon: TrendingUp, color: 'text-green-600' },
            { label: 'Redeemed', value: data.redeemed, icon: RotateCcw, color: 'text-blue-600' },
            { label: 'Available', value: data.available, icon: Gift, color: 'text-amber-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-ocean-900 rounded-xl p-4 text-center shadow-sm"
            >
              <Icon size={20} className={`mx-auto mb-1 ${color}`} />
              <p className="text-2xl font-bold text-ocean-900 dark:text-ocean-100">{value.toLocaleString()}</p>
              <p className="text-xs text-ocean-500">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-ocean-900 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-ocean-800 dark:text-ocean-200 mb-3">How it works</h2>
          <ul className="space-y-2 text-sm text-ocean-600 dark:text-ocean-400">
            <li>• Earn <strong>1 point</strong> for every ₹1 spent on delivered orders</li>
            <li>• Redeem in multiples of 100 — every 100 points = <strong>₹{(100 * data.discountPerPoint).toFixed(0)} discount</strong></li>
            <li>• Minimum {data.minRedeem} points required to redeem</li>
          </ul>
        </div>

        {/* Redeem */}
        {data.available >= data.minRedeem && (
          <div className="bg-white dark:bg-ocean-900 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-ocean-800 dark:text-ocean-200 mb-3">Redeem Points</h2>
            <div className="flex gap-3">
              <input
                type="number"
                min={data.minRedeem}
                step={100}
                max={data.available}
                value={redeemInput}
                onChange={e => setRedeemInput(e.target.value)}
                placeholder={`Min ${data.minRedeem} pts`}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-ocean-200 dark:border-ocean-700 bg-white dark:bg-ocean-900 text-ocean-900 dark:text-ocean-100 focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
              <button
                onClick={() => redeemMutation.mutate(points)}
                disabled={points < data.minRedeem || points > data.available || points % 100 !== 0 || redeemMutation.isPending}
                className="px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-amber-600 transition-colors"
              >
                {redeemMutation.isPending ? 'Processing…' : 'Redeem'}
              </button>
            </div>
            {discountPreview && (
              <p className="text-xs text-green-600 mt-2">You'll get ₹{discountPreview} discount</p>
            )}
            {redeemMutation.isSuccess && (
              <p className="text-xs text-green-600 mt-2">
                Redeemed {redeemMutation.data?.pointsUsed} points for ₹{redeemMutation.data?.discount} off!
              </p>
            )}
            {redeemMutation.isError && (
              <p className="text-xs text-red-500 mt-2">
                {(redeemMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to redeem. Try again.'}
              </p>
            )}
          </div>
        )}

        {/* Recent earning history */}
        {data.recentOrders.length > 0 && (
          <div className="bg-white dark:bg-ocean-900 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-ocean-800 dark:text-ocean-200 mb-3">Recent Earnings</h2>
            <div className="space-y-2">
              {data.recentOrders.map(o => (
                <div key={o.orderNumber} className="flex items-center justify-between text-sm">
                  <span className="text-ocean-600 dark:text-ocean-400">
                    Order #{o.orderNumber}
                    <span className="text-xs text-ocean-400 ml-2">
                      {new Date(o.date).toLocaleDateString('en-IN')}
                    </span>
                  </span>
                  <span className="font-medium text-amber-600">+{o.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
