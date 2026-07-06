import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Search, Package, Truck, CheckCircle, XCircle, Clock } from 'lucide-react'
import { orderApi, type Order } from '@/services/api/orderApi'
import { DeliveryStatusStepper } from '@/components/shared/DeliveryStatusStepper'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { ROUTES } from '@/constants/routes'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'Pending',    color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', icon: <Clock size={13} /> },
  confirmed:  { label: 'Confirmed',  color: 'text-premium-teal bg-premium-teal/10',                icon: <CheckCircle size={13} /> },
  processing: { label: 'Processing', color: 'text-premium-navy bg-premium-navy/10',                icon: <Package size={13} /> },
  shipped:    { label: 'Shipped',    color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',       icon: <Truck size={13} /> },
  delivered:  { label: 'Delivered',  color: 'text-green-600 bg-green-50 dark:bg-green-900/20',    icon: <CheckCircle size={13} /> },
  cancelled:  { label: 'Cancelled',  color: 'text-red-500 bg-red-50 dark:bg-red-900/20',          icon: <XCircle size={13} /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail]             = useState('')
  const [order, setOrder]             = useState<Order | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setOrder(null)
    setLoading(true)
    try {
      const found = await orderApi.trackGuestOrder(orderNumber.trim(), email.trim())
      setOrder(found)
    } catch {
      setError('No order found with that order number and email. Double-check both and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Helmet><title>Track Your Order — Divya Luxury Seafoods</title></Helmet>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-2 text-center">
          Track Your Order
        </h1>
        <p className="text-sm text-premium-navy/40 text-center mb-8">
          Enter your order number and the email you used at checkout.
        </p>

        <form onSubmit={handleTrack} className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Order Number</label>
              <input
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                required
                className="df-input w-full" placeholder="DF-20260101-0001"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="df-input w-full" placeholder="you@example.com"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mt-4">
              {error}
            </div>
          )}

          <Button type="submit" variant="premium" size="lg" className="w-full mt-5" loading={loading} leftIcon={<Search size={16} />}>
            Track Order
          </Button>
        </form>

        {order && (
          <div className="flex flex-col gap-4">
            <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div>
                  <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-1">Order Number</p>
                  <h2 className="font-display text-lg font-semibold text-premium-navy dark:text-white">{order.orderNumber}</h2>
                  <p className="text-xs text-premium-navy/40 mt-0.5">Placed on {formatDate(order.createdAt)}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <DeliveryStatusStepper status={order.status} />
            </div>

            <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5">
              <h3 className="font-semibold text-premium-navy dark:text-white mb-3">Items</h3>
              <div className="divide-y divide-premium-navy/10 dark:divide-ocean-800">
                {order.items.map((item, i) => (
                  <div key={i} className="flex gap-3 py-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-premium-navy/5 dark:bg-ocean-800">
                      {item.image
                        ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-premium-navy/30" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-premium-navy dark:text-white line-clamp-1">{item.name}</p>
                      <p className="text-xs text-premium-navy/40">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                    </div>
                    <span className="text-sm font-semibold text-premium-gold shrink-0">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold text-premium-navy dark:text-white border-t border-premium-navy/10 dark:border-ocean-800 pt-3 mt-2">
                <span>Total Paid</span><span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {order.delivery && (
              <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5">
                <h3 className="font-semibold text-premium-navy dark:text-white mb-3 flex items-center gap-2">
                  <Truck size={16} className="text-premium-teal" /> Delivery Tracking
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {order.delivery.provider && (
                    <div>
                      <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-0.5">Provider</p>
                      <p className="font-medium text-premium-navy dark:text-white">{order.delivery.provider}</p>
                    </div>
                  )}
                  {order.delivery.trackingId && (
                    <div>
                      <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-0.5">Tracking Number</p>
                      <p className="font-medium text-premium-navy dark:text-white font-mono text-xs">{order.delivery.trackingId}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Link to={ROUTES.PRODUCTS}
              className="text-center py-2.5 px-4 bg-premium-gold hover:bg-premium-gold-light text-premium-navy rounded-xl text-sm font-medium transition-colors">
              Continue Shopping
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
