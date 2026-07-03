import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Gift, Copy, Check, Users, Tag, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import { useAppSelector } from '@/hooks/useAppSelector'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

interface ReferralData {
  code: string
  signups: number
  creditPerSignup: number
}

export default function ReferralPage() {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated)
  const [copied, setCopied] = useState(false)
  const [redeemCode, setRedeemCode] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['referrals', 'my'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<ReferralData>>('/referrals/my')
      return data.data
    },
    enabled: isAuthenticated,
  })

  const redeemMutation = useMutation({
    mutationFn: async (code: string) => {
      const { data } = await axiosInstance.post<ApiResponse<{ coupon: string; discount: number }>>('/referrals/redeem', { code })
      return data.data
    },
    onSuccess: (res) => {
      toast.success(`Coupon ${res.coupon} added — ₹${res.discount} off your next order!`)
      setRedeemCode('')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Could not redeem code.')
    },
  })

  function copyCode() {
    if (!data?.code) return
    navigator.clipboard.writeText(data.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = `https://divya-foods.vercel.app/auth/register?ref=${data?.code ?? ''}`

  if (!isAuthenticated) {
    return (
      <>
        <Helmet><title>Refer & Earn — Divya Foods</title></Helmet>
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <Gift size={56} className="mx-auto text-ocean-200 mb-5" />
          <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white mb-2">Refer & Earn</h1>
          <p className="text-ocean-400 mb-6">Sign in to get your personal referral code and earn ₹100 per friend who joins.</p>
          <Link
            to={ROUTES.AUTH.LOGIN}
            className="inline-flex items-center gap-2 bg-ocean-700 hover:bg-ocean-900 text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <LogIn size={18} /> Sign In
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet><title>Refer & Earn — Divya Foods</title></Helmet>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white mb-2">Refer & Earn</h1>
        <p className="text-ocean-400 mb-8">Share your code. Your friend gets ₹100 off. You get notified every time someone joins.</p>

        {/* Your code */}
        <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-3">Your Referral Code</p>
          {isLoading ? (
            <div className="h-12 bg-ocean-100 dark:bg-ocean-800 rounded-xl animate-pulse" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 font-mono text-2xl font-bold tracking-widest text-ocean-900 dark:text-white bg-ocean-50 dark:bg-ocean-800 px-5 py-3 rounded-xl">
                {data?.code}
              </div>
              <button
                onClick={copyCode}
                className="p-3 bg-ocean-700 hover:bg-ocean-900 text-white rounded-xl transition-colors"
                aria-label="Copy code"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 text-center">
            <Users size={24} className="mx-auto text-ocean-400 mb-2" />
            <p className="text-3xl font-bold text-ocean-900 dark:text-white">{data?.signups ?? 0}</p>
            <p className="text-xs text-ocean-400 mt-1">Friends joined</p>
          </div>
          <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 text-center">
            <Gift size={24} className="mx-auto text-gold-500 mb-2" />
            <p className="text-3xl font-bold text-ocean-900 dark:text-white">₹{(data?.signups ?? 0) * (data?.creditPerSignup ?? 100)}</p>
            <p className="text-xs text-ocean-400 mt-1">Total credit earned</p>
          </div>
        </div>

        {/* Share */}
        <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-3">Share via</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hey! Use my Divya Foods referral code *${data?.code}* and get ₹100 off your first order of premium seafood 🦐🐟 — ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              WhatsApp
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl)
                toast.success('Referral link copied!')
              }}
              className="flex items-center gap-2 px-4 py-2 border border-ocean-200 dark:border-ocean-700 rounded-xl text-sm font-medium text-ocean-700 dark:text-ocean-200 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
            >
              <Copy size={14} /> Copy Link
            </button>
          </div>
        </div>

        {/* Redeem someone else's code */}
        <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-1">Have a friend's code?</p>
          <p className="text-sm text-ocean-500 mb-3">Enter it below to get ₹100 off your next order.</p>
          <div className="flex gap-2">
            <input
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              placeholder="Enter referral code"
              maxLength={10}
              className="flex-1 border border-ocean-200 dark:border-ocean-700 rounded-xl px-3 py-2 text-sm font-mono dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500"
            />
            <Button
              variant="primary"
              size="sm"
              loading={redeemMutation.isPending}
              disabled={redeemCode.length < 4}
              onClick={() => redeemMutation.mutate(redeemCode)}
              leftIcon={<Tag size={14} />}
            >
              Redeem
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
