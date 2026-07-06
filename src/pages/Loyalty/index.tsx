import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Star, Gift, TrendingUp, RotateCcw, Crown, PartyPopper } from 'lucide-react'
import { motion } from 'framer-motion'
import axiosInstance from '@/services/api/axiosInstance'
import { queryKeys } from '@/services/queryKeys'
import type { LoyaltyBalance, MembershipInfo } from '@/types'
import { formatCurrency } from '@/utils/formatCurrency'

const TIER_STYLES: Record<string, { badge: string; icon: string }> = {
  Silver:   { badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', icon: 'text-slate-400' },
  Gold:     { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: 'text-amber-500' },
  Platinum: { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', icon: 'text-violet-500' },
}

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

  const { data: membership } = useQuery({
    queryKey: queryKeys.loyalty.membership(),
    queryFn: async () => {
      const res = await axiosInstance.get<{ success: boolean; data: MembershipInfo }>('/loyalty/membership')
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
        <div className="animate-spin w-8 h-8 border-2 border-premium-gold border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!data) return null

  const discountPreview = points > 0 ? (points * data.discountPerPoint).toFixed(2) : null

  return (
    <div className="min-h-screen bg-premium-cream dark:bg-ocean-950 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-premium-navy dark:text-ocean-100 flex items-center gap-2">
          <Star className="text-premium-gold" size={24} fill="currentColor" />
          Loyalty Points
        </h1>

        {data.birthdayBonusGranted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-400 to-pink-400 text-white rounded-xl p-4 flex items-center gap-3 shadow-sm"
          >
            <PartyPopper size={22} className="shrink-0" />
            <p className="text-sm font-medium">
              Happy Birthday! We've added {data.birthdayBonusPoints} bonus points to your account.
            </p>
          </motion.div>
        )}

        {membership && (
          <div className="bg-white dark:bg-ocean-900 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown size={18} className={TIER_STYLES[membership.tier]?.icon} />
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${TIER_STYLES[membership.tier]?.badge}`}>
                  {membership.tier} Member
                </span>
              </div>
              <span className="text-xs text-premium-navy/40">Lifetime spend: {formatCurrency(membership.lifetimeSpend)}</span>
            </div>
            {membership.perks.freeDelivery ? (
              <p className="text-sm text-premium-navy/70 dark:text-ocean-400">You get free delivery on every order.</p>
            ) : membership.perks.freeDeliveryAbove != null ? (
              <p className="text-sm text-premium-navy/70 dark:text-ocean-400">
                You get free delivery on orders above {formatCurrency(membership.perks.freeDeliveryAbove)}.
              </p>
            ) : null}
            {membership.nextTier && membership.amountToNextTier != null && (
              <p className="text-xs text-premium-navy/40 mt-2">
                Spend {formatCurrency(membership.amountToNextTier)} more to reach {membership.nextTier}.
              </p>
            )}
          </div>
        )}

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
              <p className="text-2xl font-bold text-premium-navy dark:text-ocean-100">{value.toLocaleString()}</p>
              <p className="text-xs text-premium-navy/50">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-white dark:bg-ocean-900 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-premium-navy dark:text-ocean-200 mb-3">How it works</h2>
          <ul className="space-y-2 text-sm text-premium-navy/70 dark:text-ocean-400">
            <li>• Earn <strong>1 point</strong> for every ₹1 spent on delivered orders</li>
            <li>• Redeem in multiples of 100 — every 100 points = <strong>₹{(100 * data.discountPerPoint).toFixed(0)} discount</strong></li>
            <li>• Minimum {data.minRedeem} points required to redeem</li>
          </ul>
        </div>

        {/* Redeem */}
        {data.available >= data.minRedeem && (
          <div className="bg-white dark:bg-ocean-900 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-premium-navy dark:text-ocean-200 mb-3">Redeem Points</h2>
            <div className="flex gap-3">
              <input
                type="number"
                min={data.minRedeem}
                step={100}
                max={data.available}
                value={redeemInput}
                onChange={e => setRedeemInput(e.target.value)}
                placeholder={`Min ${data.minRedeem} pts`}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-premium-navy/15 dark:border-ocean-700 bg-white dark:bg-ocean-900 text-premium-navy dark:text-ocean-100 focus:outline-none focus:ring-2 focus:ring-premium-gold"
              />
              <button
                onClick={() => redeemMutation.mutate(points)}
                disabled={points < data.minRedeem || points > data.available || points % 100 !== 0 || redeemMutation.isPending}
                className="px-5 py-2 bg-premium-gold text-premium-navy text-sm font-medium rounded-lg disabled:opacity-50 hover:bg-premium-gold-light transition-colors"
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
            <h2 className="font-semibold text-premium-navy dark:text-ocean-200 mb-3">Recent Earnings</h2>
            <div className="space-y-2">
              {data.recentOrders.map(o => (
                <div key={o.orderNumber} className="flex items-center justify-between text-sm">
                  <span className="text-premium-navy/70 dark:text-ocean-400">
                    Order #{o.orderNumber}
                    <span className="text-xs text-premium-navy/40 ml-2">
                      {new Date(o.date).toLocaleDateString('en-IN')}
                    </span>
                  </span>
                  <span className="font-medium text-premium-gold">+{o.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
