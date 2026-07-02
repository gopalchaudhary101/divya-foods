import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, ChevronRight, CheckCircle, Clock, Truck, XCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { orderApi, type Order } from '@/services/api/orderApi'
import { queryKeys } from '@/services/queryKeys'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { Button } from '@/components/ui/Button'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import { ROUTES } from '@/constants/routes'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'Pending',    color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',   icon: <Clock size={13} /> },
  confirmed:  { label: 'Confirmed', color: 'text-mint-600 bg-mint-50 dark:bg-mint-900/20',         icon: <CheckCircle size={13} /> },
  processing: { label: 'Processing',color: 'text-ocean-600 bg-ocean-50 dark:bg-ocean-900/30',      icon: <Package size={13} /> },
  shipped:    { label: 'Shipped',   color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',         icon: <Truck size={13} /> },
  delivered:  { label: 'Delivered', color: 'text-green-600 bg-green-50 dark:bg-green-900/20',      icon: <CheckCircle size={13} /> },
  cancelled:  { label: 'Cancelled', color: 'text-red-500 bg-red-50 dark:bg-red-900/20',            icon: <XCircle size={13} /> },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

// ─── Order Detail page (/orders/:id) ─────────────────────────────────────────

function OrderDetail({ orderId }: { orderId: string }) {
  const location    = useLocation()
  const queryClient = useQueryClient()
  const justOrdered = (location.state as { justOrdered?: boolean })?.justOrdered
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const { data: order, isLoading, isError } = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => orderApi.getById(orderId),
  })

  const cancelMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { data } = await axiosInstance.put<ApiResponse<Order>>(
        `/orders/${orderId}/cancel`,
        { reason },
      )
      return data.data
    },
    onSuccess: () => {
      toast.success('Order cancelled successfully')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() })
      setShowCancel(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Could not cancel order. Please try again.')
    },
  })

  if (isLoading) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="w-10 h-10 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-ocean-400">Loading your order...</p>
    </div>
  )

  if (isError || !order) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <Package size={48} className="mx-auto text-ocean-200 mb-4" />
      <p className="text-ocean-500">Order not found.</p>
      <Link to={ROUTES.ORDERS} className="text-ocean-700 underline mt-2 block">View all orders</Link>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Success banner — shown right after checkout */}
      {justOrdered && (
        <div className="bg-mint-50 dark:bg-mint-900/20 border border-mint-200 dark:border-mint-800 rounded-2xl px-6 py-5 mb-6 flex items-start gap-4">
          <CheckCircle size={28} className="text-mint-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white">Payment Successful!</h2>
            <p className="text-sm text-ocean-500 mt-0.5">Thank you for your order. We'll start processing it right away and notify you when it ships.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs text-ocean-400 uppercase tracking-widest mb-1">Order Number</p>
          <h1 className="font-display text-2xl font-semibold text-ocean-900 dark:text-white">{order.orderNumber}</h1>
          <p className="text-sm text-ocean-400 mt-0.5">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold text-ocean-900 dark:text-white mb-4">Items Ordered</h3>
        <div className="divide-y divide-ocean-100 dark:divide-ocean-800">
          {order.items.map((item, i) => (
            <div key={i} className="flex gap-3 py-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-ocean-50 dark:bg-ocean-800">
                {item.image
                  ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-ocean-200" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ocean-900 dark:text-white line-clamp-1">{item.name}</p>
                <p className="text-xs text-ocean-400">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
              </div>
              <span className="text-sm font-bold text-ocean-900 dark:text-white shrink-0">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Price summary */}
        <div className="border-t border-ocean-100 dark:border-ocean-800 pt-4 mt-2 space-y-2">
          <div className="flex justify-between text-sm text-ocean-600 dark:text-ocean-300">
            <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-ocean-600 dark:text-ocean-300">
            <span>Delivery</span>
            <span className={order.deliveryCharge === 0 ? 'text-mint-500 font-medium' : ''}>
              {order.deliveryCharge === 0 ? 'FREE' : formatCurrency(order.deliveryCharge)}
            </span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm text-mint-600">
              <span>Discount ({order.couponCode})</span><span>−{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-ocean-900 dark:text-white border-t border-ocean-100 dark:border-ocean-800 pt-2">
            <span>Total Paid</span><span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold text-ocean-900 dark:text-white mb-3">Delivery Address</h3>
        <p className="text-sm text-ocean-700 dark:text-ocean-200">
          <strong>{order.deliveryAddress.fullName}</strong> · {order.deliveryAddress.phone}<br />
          {order.deliveryAddress.addressLine1}
          {order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}<br />
          {order.deliveryAddress.city}, {order.deliveryAddress.state} — {order.deliveryAddress.pincode}
        </p>
      </div>

      {/* Tracking timeline */}
      {order.trackingTimeline.length > 0 && (
        <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-ocean-900 dark:text-white mb-4">Order Timeline</h3>
          <div className="relative pl-5">
            <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-ocean-100 dark:bg-ocean-800" />
            {[...order.trackingTimeline].reverse().map((event, i) => (
              <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="absolute -left-3 w-3 h-3 rounded-full bg-ocean-500 mt-1 shrink-0" />
                <div>
                  <p className="text-sm font-medium capitalize text-ocean-900 dark:text-white">{event.status}</p>
                  {event.note && <p className="text-xs text-ocean-400">{event.note}</p>}
                  <p className="text-xs text-ocean-300 mt-0.5">{formatDate(event.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel section — only for pending/confirmed */}
      {(order.status === 'pending' || order.status === 'confirmed') && (
        <div className="bg-white dark:bg-ocean-900 border border-red-100 dark:border-red-900/40 rounded-2xl p-5 mb-4">
          {!showCancel ? (
            <button
              onClick={() => setShowCancel(true)}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              <XCircle size={16} /> Cancel this order
            </button>
          ) : (
            <div>
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-ocean-700 dark:text-ocean-200">
                  Are you sure you want to cancel <strong>{order.orderNumber}</strong>?
                  {order.paymentStatus === 'paid' && ' A refund will be processed within 5–7 business days.'}
                </p>
              </div>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)"
                rows={2}
                className="input-field w-full mb-3 resize-none"
              />
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowCancel(false)}>
                  Keep Order
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 border-red-600"
                  loading={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(cancelReason)}
                >
                  Confirm Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <Link to={ROUTES.ORDERS}
          className="flex-1 text-center py-2.5 px-4 border border-ocean-200 dark:border-ocean-700 rounded-xl text-sm font-medium text-ocean-700 dark:text-ocean-200 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors">
          All Orders
        </Link>
        <Link to={ROUTES.PRODUCTS}
          className="flex-1 text-center py-2.5 px-4 bg-ocean-700 hover:bg-ocean-900 text-white rounded-xl text-sm font-medium transition-colors">
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}

// ─── Orders list page (/orders) ───────────────────────────────────────────────

function OrdersList() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.orders.all(),
    queryFn: () => orderApi.getMyOrders(),
  })

  if (isLoading) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="w-10 h-10 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  )

  const orders: Order[] = data?.data ?? []

  if (orders.length === 0) return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <Package size={56} className="mx-auto text-ocean-200 dark:text-ocean-700 mb-5" />
      <h1 className="font-display text-2xl font-semibold text-ocean-900 dark:text-white mb-2">No orders yet</h1>
      <p className="text-ocean-400 mb-6">Once you place an order, it'll appear here.</p>
      <Link to={ROUTES.PRODUCTS}
        className="inline-flex items-center gap-2 bg-ocean-700 hover:bg-ocean-900 text-white px-6 py-3 rounded-xl font-medium transition-colors">
        Shop Now
      </Link>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl font-semibold text-ocean-900 dark:text-white mb-6">My Orders</h1>
      <div className="flex flex-col gap-4">
        {orders.map(order => (
          <Link key={order.id} to={`/orders/${order.id}`}
            className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 hover:shadow-md transition-shadow flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-ocean-900 dark:text-white text-sm">{order.orderNumber}</span>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-xs text-ocean-400">{formatDate(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
              <p className="text-sm font-bold text-ocean-900 dark:text-white mt-1">{formatCurrency(order.total)}</p>
            </div>
            <ChevronRight size={18} className="text-ocean-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Route entry point ────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { id } = useParams<{ id?: string }>()
  return (
    <>
      <Helmet><title>{id ? 'Order Details' : 'My Orders'} — Divya Foods</title></Helmet>
      {id ? <OrderDetail orderId={id} /> : <OrdersList />}
    </>
  )
}
