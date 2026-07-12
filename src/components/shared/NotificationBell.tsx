import React, { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Check, Package, Tag, Info, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAppSelector } from '@/hooks/useAppSelector'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import { ROUTES } from '@/constants/routes'

interface AppNotification {
  id: string
  type: 'order_update' | 'promotion' | 'system'
  title: string
  message: string
  is_read: boolean
  data: Record<string, string>
  created_at: string
}

const TYPE_ICON = {
  order_update: <Package size={14} className="text-premium-teal" />,
  promotion:    <Tag size={14} className="text-premium-gold" />,
  system:       <Info size={14} className="text-premium-teal" />,
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { status: pushStatus, subscribe, unsubscribe } = usePushNotifications()

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<AppNotification[]>>('/notifications')
      return data.data
    },
    enabled: isAuthenticated && open,
    staleTime: 30_000,
  })

  const markAllRead = useMutation({
    mutationFn: () => axiosInstance.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Unread count (quick check without opening dropdown)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<number>>('/notifications/unread-count')
      return data.data
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (!isAuthenticated) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-1.5 sm:p-2.5 rounded-lg text-premium-muted hover:text-white hover:bg-premium-charcoal transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-premium-charcoal rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-premium-muted hover:text-premium-gold flex items-center gap-1 transition-colors"
                  >
                    <Check size={11} /> Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-premium-muted hover:text-premium-gold transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Push toggle */}
            <div className="px-4 py-2.5 bg-premium-navy/50 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {pushStatus === 'subscribed'
                  ? <Bell size={13} className="text-premium-teal" />
                  : <BellOff size={13} className="text-premium-muted" />}
                <span className="text-xs text-premium-cream/80">
                  {pushStatus === 'subscribed'   ? 'Push notifications on'  :
                   pushStatus === 'denied'       ? 'Notifications blocked'  :
                   pushStatus === 'unsupported'  ? 'Not supported'          :
                   pushStatus === 'loading'      ? 'Loading…'               :
                                                   'Push notifications off'}
                </span>
              </div>
              {(pushStatus === 'unsubscribed' || pushStatus === 'subscribed') && (
                <button
                  onClick={() => pushStatus === 'subscribed' ? unsubscribe() : subscribe()}
                  className="text-xs font-medium text-premium-cream/80 hover:text-white transition-colors"
                >
                  {pushStatus === 'subscribed' ? 'Turn off' : 'Turn on'}
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={28} className="mx-auto text-premium-muted mb-2" />
                  <p className="text-xs text-premium-muted">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => {
                  const linkTarget = n.data?.order_id
                    ? `/orders/${n.data.order_id}`
                    : ROUTES.ORDERS

                  return (
                    <Link
                      key={n.id}
                      to={linkTarget}
                      onClick={() => setOpen(false)}
                      className={[
                        'flex gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors last:border-b-0',
                        !n.is_read ? 'bg-white/[0.03]' : '',
                      ].join(' ')}
                    >
                      <div className="w-7 h-7 rounded-full bg-premium-navy flex items-center justify-center shrink-0 mt-0.5">
                        {TYPE_ICON[n.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white leading-snug">
                          {n.title}
                          {!n.is_read && (
                            <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-premium-gold rounded-full align-middle" />
                          )}
                        </p>
                        <p className="text-xs text-premium-muted mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-premium-muted/70 mt-0.5">{timeAgo(n.created_at)}</p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
