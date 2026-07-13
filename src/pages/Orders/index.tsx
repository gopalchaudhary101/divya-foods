import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, ChevronRight, CheckCircle, Clock, Truck, XCircle, AlertTriangle, Star, Download, Printer, Mail, RotateCcw } from 'lucide-react'
import { WriteReviewModal } from '@/components/shared/WriteReviewModal'
import { DeliveryStatusStepper } from '@/components/shared/DeliveryStatusStepper'
import toast from 'react-hot-toast'
import { orderApi, type Order } from '@/services/api/orderApi'
import { returnApi, type ReturnReason, type ReturnStatus } from '@/services/api/returnApi'
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
  confirmed:  { label: 'Confirmed', color: 'text-premium-teal bg-premium-teal/10',                  icon: <CheckCircle size={13} /> },
  processing: { label: 'Processing',color: 'text-premium-navy bg-premium-navy/10',                 icon: <Package size={13} /> },
  shipped:    { label: 'Shipped',   color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',         icon: <Truck size={13} /> },
  delivered:  { label: 'Delivered', color: 'text-green-600 bg-green-50 dark:bg-green-900/20',      icon: <CheckCircle size={13} /> },
  cancelled:  { label: 'Cancelled', color: 'text-red-500 bg-red-50 dark:bg-red-900/20',            icon: <XCircle size={13} /> },
}

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  packed: 'Packed', ready_for_pickup: 'Ready for Pickup', picked_up: 'Picked Up',
  in_transit: 'In Transit', near_delivery: 'Arriving Soon', delivered: 'Delivered',
  failed: 'Delivery Failed', cancelled: 'Delivery Cancelled',
}

function formatTimelineStatus(status: string): string {
  if (status.startsWith('delivery_')) {
    const key = status.replace('delivery_', '')
    return DELIVERY_STATUS_LABELS[key] ?? key
  }
  return status
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

// ─── Return/refund helpers ────────────────────────────────────────────────────

const RETURN_WINDOW_HOURS = 24

const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  wrong_item: 'Wrong item delivered',
  damaged_or_spoiled: 'Damaged or spoiled on arrival',
  missing_item: 'Item missing from delivery',
  other: 'Other',
}

const RETURN_STATUS_CONFIG: Record<ReturnStatus, { label: string; color: string }> = {
  requested: { label: 'Return Requested', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
  approved:  { label: 'Return Approved',  color: 'text-premium-teal bg-premium-teal/10' },
  rejected:  { label: 'Return Rejected',  color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  refunded:  { label: 'Refunded',         color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
}

// ─── Order Detail page (/orders/:id) ─────────────────────────────────────────

function OrderDetail({ orderId }: { orderId: string }) {
  const location    = useLocation()
  const queryClient = useQueryClient()
  const justOrdered = (location.state as { justOrdered?: boolean })?.justOrdered
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [reviewTarget, setReviewTarget] = useState<{ productId: string; productName: string } | null>(null)
  const [invoiceAction, setInvoiceAction] = useState<'download' | 'print' | 'email' | null>(null)
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [returnReason, setReturnReason] = useState<ReturnReason>('damaged_or_spoiled')
  const [returnNote, setReturnNote] = useState('')
  const [returnItems, setReturnItems] = useState<Record<string, number>>({})

  const { data: order, isLoading, isError } = useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: () => orderApi.getById(orderId),
  })

  const { data: existingReturn } = useQuery({
    queryKey: queryKeys.returns.forOrder(orderId),
    queryFn: () => returnApi.getForOrder(orderId),
    enabled: order?.status === 'delivered',
  })

  const returnMutation = useMutation({
    mutationFn: () => returnApi.request(
      orderId,
      returnReason,
      returnNote,
      Object.entries(returnItems)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    ),
    onSuccess: () => {
      toast.success('Return request submitted — we\'ll review it shortly')
      queryClient.invalidateQueries({ queryKey: queryKeys.returns.forOrder(orderId) })
      setShowReturnForm(false)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg ?? 'Could not submit return request. Please try again.')
    },
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
      <div className="w-10 h-10 border-4 border-premium-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-premium-navy/40">Loading your order...</p>
    </div>
  )

  if (isError || !order) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <Package size={48} className="mx-auto text-premium-navy/20 mb-4" />
      <p className="text-premium-navy/50">Order not found.</p>
      <Link to={ROUTES.ORDERS} className="text-premium-teal underline mt-2 block">View all orders</Link>
    </div>
  )

  async function handleDownloadInvoice() {
    setInvoiceAction('download')
    try {
      await orderApi.downloadInvoice(order!.id, order!.orderNumber)
    } catch {
      toast.error('Failed to download invoice')
    } finally {
      setInvoiceAction(null)
    }
  }

  async function handlePrintInvoice() {
    setInvoiceAction('print')
    try {
      await orderApi.printInvoice(order!.id)
    } catch {
      toast.error('Failed to open invoice')
    } finally {
      setInvoiceAction(null)
    }
  }

  async function handleEmailInvoice() {
    setInvoiceAction('email')
    try {
      const message = await orderApi.emailInvoice(order!.id)
      toast.success(message)
    } catch {
      toast.error('Failed to email invoice')
    } finally {
      setInvoiceAction(null)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Success banner — shown right after checkout */}
      {justOrdered && (
        <div className="bg-premium-teal/10 border border-premium-teal/30 rounded-2xl px-6 py-5 mb-6 flex items-start gap-4">
          <CheckCircle size={28} className="text-premium-teal shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-lg font-semibold text-premium-navy dark:text-white">Payment Successful!</h2>
            <p className="text-sm text-premium-navy/60 mt-0.5">Thank you for your order. We'll start processing it right away and notify you when it ships.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-1">Order Number</p>
          <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white">{order.orderNumber}</h1>
          <p className="text-sm text-premium-navy/40 mt-0.5">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Invoice actions */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={handleDownloadInvoice}
          disabled={invoiceAction === 'download'}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-premium-navy/15 dark:border-ocean-700 rounded-xl text-premium-navy/70 dark:text-ocean-300 hover:bg-premium-navy/5 dark:hover:bg-ocean-800 transition-colors disabled:opacity-50"
        >
          <Download size={13} /> {invoiceAction === 'download' ? 'Downloading…' : 'Download Invoice'}
        </button>
        <button
          onClick={handlePrintInvoice}
          disabled={invoiceAction === 'print'}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-premium-navy/15 dark:border-ocean-700 rounded-xl text-premium-navy/70 dark:text-ocean-300 hover:bg-premium-navy/5 dark:hover:bg-ocean-800 transition-colors disabled:opacity-50"
        >
          <Printer size={13} /> {invoiceAction === 'print' ? 'Opening…' : 'Print Invoice'}
        </button>
        <button
          onClick={handleEmailInvoice}
          disabled={invoiceAction === 'email'}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-premium-navy/15 dark:border-ocean-700 rounded-xl text-premium-navy/70 dark:text-ocean-300 hover:bg-premium-navy/5 dark:hover:bg-ocean-800 transition-colors disabled:opacity-50"
        >
          <Mail size={13} /> {invoiceAction === 'email' ? 'Sending…' : 'Email Invoice'}
        </button>
      </div>

      {/* Visual status stepper */}
      <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold text-premium-navy/40 uppercase tracking-widest mb-4">Order Progress</p>
        <DeliveryStatusStepper status={order.status} />
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold text-premium-navy dark:text-white mb-4">Items Ordered</h3>
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
                {order.status === 'delivered' && (
                  <button
                    onClick={() => setReviewTarget({ productId: item.productId, productName: item.name })}
                    className="mt-1 text-xs text-premium-navy/50 hover:text-premium-gold transition-colors flex items-center gap-1"
                  >
                    <Star size={11} /> Rate this item
                  </button>
                )}
              </div>
              <span className="text-sm font-semibold text-premium-gold shrink-0">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Price summary */}
        <div className="border-t border-premium-navy/10 dark:border-ocean-800 pt-4 mt-2 space-y-2">
          <div className="flex justify-between text-sm text-premium-navy/70 dark:text-ocean-300">
            <span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-premium-navy/70 dark:text-ocean-300">
            <span>Delivery</span>
            <span className={order.deliveryCharge === 0 ? 'text-premium-teal font-medium' : ''}>
              {order.deliveryCharge === 0 ? 'FREE' : formatCurrency(order.deliveryCharge)}
            </span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm text-premium-teal">
              <span>Discount ({order.couponCode})</span><span>−{formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-premium-navy dark:text-white border-t border-premium-navy/10 dark:border-ocean-800 pt-2">
            <span>Total Paid</span><span className="text-premium-gold">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Delivery address */}
      <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold text-premium-navy dark:text-white mb-3">Delivery Address</h3>
        <p className="text-sm text-premium-navy/80 dark:text-ocean-200">
          <strong>{order.deliveryAddress.fullName}</strong> · {order.deliveryAddress.phone}<br />
          {order.deliveryAddress.addressLine1}
          {order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}<br />
          {order.deliveryAddress.city}, {order.deliveryAddress.state} — {order.deliveryAddress.pincode}
        </p>
      </div>

      {/* Delivery tracking */}
      {order.delivery && (
        <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 mb-4">
          <h3 className="font-semibold text-premium-navy dark:text-white mb-3 flex items-center gap-2">
            <Truck size={16} className="text-premium-teal" /> Delivery Tracking
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-0.5">Status</p>
              <p className="font-medium text-premium-navy dark:text-white">
                {DELIVERY_STATUS_LABELS[order.delivery.deliveryStatus] ?? order.delivery.deliveryStatus}
              </p>
            </div>
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
            {order.delivery.estimatedDeliveryAt && (
              <div>
                <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-0.5">Est. Delivery</p>
                <p className="font-medium text-premium-navy dark:text-white">{formatDate(order.delivery.estimatedDeliveryAt)}</p>
              </div>
            )}
            {order.delivery.driverName && (
              <div>
                <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-0.5">Delivery Partner</p>
                <p className="font-medium text-premium-navy dark:text-white">
                  {order.delivery.driverName}{order.delivery.driverPhone && ` · ${order.delivery.driverPhone}`}
                </p>
              </div>
            )}
          </div>

          {order.delivery.proofOfDeliveryUrl && (
            <div className="mt-4 pt-4 border-t border-premium-navy/10 dark:border-ocean-800">
              <p className="text-xs text-premium-navy/40 uppercase tracking-widest mb-2">Proof of Delivery</p>
              <img
                src={order.delivery.proofOfDeliveryUrl}
                alt="Proof of delivery"
                className="w-32 h-32 object-cover rounded-xl border border-premium-navy/10 dark:border-ocean-800"
              />
            </div>
          )}
        </div>
      )}

      {/* Tracking timeline */}
      {order.trackingTimeline.length > 0 && (
        <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-premium-navy dark:text-white mb-4">Order Timeline</h3>
          <div className="relative pl-5">
            <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-premium-navy/10 dark:bg-ocean-800" />
            {[...order.trackingTimeline].reverse().map((event, i) => (
              <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="absolute -left-3 w-3 h-3 rounded-full bg-premium-gold mt-1 shrink-0" />
                <div>
                  <p className="text-sm font-medium capitalize text-premium-navy dark:text-white">{formatTimelineStatus(event.status)}</p>
                  {event.note && <p className="text-xs text-premium-navy/40">{event.note}</p>}
                  <p className="text-xs text-premium-navy/30 mt-0.5">{formatDate(event.timestamp)}</p>
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
                <p className="text-sm text-premium-navy/80 dark:text-ocean-200">
                  Are you sure you want to cancel <strong>{order.orderNumber}</strong>?
                  {order.paymentStatus === 'paid' && ' A refund will be processed within 5–7 business days.'}
                </p>
              </div>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)"
                rows={2}
                className="df-input w-full mb-3 resize-none"
              />
              <div className="flex gap-3">
                <Button variant="premiumOutline" size="sm" onClick={() => setShowCancel(false)}>
                  Keep Order
                </Button>
                <Button
                  variant="danger"
                  size="sm"
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

      {/* Return/refund section — only for delivered orders */}
      {order.status === 'delivered' && (() => {
        const deliveredEvent = [...order.trackingTimeline].reverse().find(e => e.status === 'delivered')
        const hoursSinceDelivery = deliveredEvent
          ? (Date.now() - new Date(deliveredEvent.timestamp).getTime()) / 3_600_000
          : Infinity
        const windowExpired = hoursSinceDelivery > RETURN_WINDOW_HOURS

        return (
          <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 mb-4">
            {existingReturn ? (
              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h3 className="font-semibold text-premium-navy dark:text-white">Return Request</h3>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${RETURN_STATUS_CONFIG[existingReturn.status].color}`}>
                    {RETURN_STATUS_CONFIG[existingReturn.status].label}
                  </span>
                </div>
                <p className="text-sm text-premium-navy/70 dark:text-ocean-300">
                  {existingReturn.items.map(i => `${i.quantity}× ${i.name}`).join(', ')} · Refund amount: {formatCurrency(existingReturn.refundAmount)}
                </p>
                {existingReturn.status === 'rejected' && existingReturn.adminNote && (
                  <p className="text-xs text-red-500 mt-2"><strong>Reason:</strong> {existingReturn.adminNote}</p>
                )}
              </div>
            ) : windowExpired ? (
              <p className="text-sm text-premium-navy/50 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" /> The {RETURN_WINDOW_HOURS}-hour return window for this order has passed.
              </p>
            ) : !showReturnForm ? (
              <button
                onClick={() => setShowReturnForm(true)}
                className="flex items-center gap-2 text-sm text-premium-teal hover:text-premium-navy dark:hover:text-white font-medium transition-colors"
              >
                <RotateCcw size={16} /> Request a return or refund
              </button>
            ) : (
              <div>
                <p className="text-sm font-semibold text-premium-navy dark:text-white mb-3">Select items to return</p>
                <div className="space-y-2 mb-3">
                  {order.items.map(item => {
                    const checked = item.productId in returnItems
                    return (
                      <div key={item.productId} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => setReturnItems(prev => {
                            const next = { ...prev }
                            if (e.target.checked) next[item.productId] = item.quantity
                            else delete next[item.productId]
                            return next
                          })}
                        />
                        <span className="flex-1 text-sm text-premium-navy dark:text-white">{item.name}</span>
                        {checked && (
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={returnItems[item.productId]}
                            onChange={e => setReturnItems(prev => ({
                              ...prev,
                              [item.productId]: Math.min(item.quantity, Math.max(1, Number(e.target.value) || 1)),
                            }))}
                            className="df-input w-16 text-sm py-1"
                          />
                        )}
                        <span className="text-xs text-premium-navy/40 w-16 text-right">of {item.quantity}</span>
                      </div>
                    )
                  })}
                </div>
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value as ReturnReason)}
                  className="df-input w-full mb-3"
                >
                  {(Object.entries(RETURN_REASON_LABELS) as [ReturnReason, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <textarea
                  value={returnNote}
                  onChange={e => setReturnNote(e.target.value)}
                  placeholder="Additional details (optional)"
                  rows={2}
                  className="df-input w-full mb-3 resize-none"
                />
                <div className="flex gap-3">
                  <Button variant="premiumOutline" size="sm" onClick={() => setShowReturnForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="premium"
                    size="sm"
                    loading={returnMutation.isPending}
                    disabled={Object.keys(returnItems).length === 0}
                    onClick={() => returnMutation.mutate()}
                  >
                    Submit Request
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <div className="flex gap-3 flex-wrap">
        <Link to={ROUTES.ORDERS}
          className="flex-1 text-center py-2.5 px-4 border border-premium-navy/15 dark:border-ocean-700 rounded-xl text-sm font-medium text-premium-navy dark:text-ocean-200 hover:bg-premium-navy/5 dark:hover:bg-ocean-800 transition-colors">
          All Orders
        </Link>
        <Link to={ROUTES.PRODUCTS}
          className="flex-1 text-center py-2.5 px-4 bg-premium-gold hover:bg-premium-gold-light text-premium-navy rounded-xl text-sm font-medium transition-colors">
          Continue Shopping
        </Link>
      </div>

      {reviewTarget && (
        <WriteReviewModal
          productId={reviewTarget.productId}
          productName={reviewTarget.productName}
          onClose={() => setReviewTarget(null)}
        />
      )}
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
      <div className="w-10 h-10 border-4 border-premium-gold border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  )

  const orders: Order[] = data?.data ?? []

  if (orders.length === 0) return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center">
      <Package size={56} className="mx-auto text-premium-navy/20 dark:text-ocean-700 mb-5" />
      <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-2">No orders yet</h1>
      <p className="text-premium-navy/40 mb-6">Once you place an order, it'll appear here.</p>
      <Link to={ROUTES.PRODUCTS}
        className="inline-flex items-center gap-2 bg-premium-gold hover:bg-premium-gold-light text-premium-navy px-6 py-3 rounded-xl font-medium transition-colors">
        Shop Now
      </Link>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-6">My Orders</h1>
      <div className="flex flex-col gap-4">
        {orders.map(order => (
          <Link key={order.id} to={`/orders/${order.id}`}
            className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 hover:shadow-md transition-shadow flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-premium-navy dark:text-white text-sm">{order.orderNumber}</span>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-xs text-premium-navy/40">{formatDate(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
              <p className="text-sm font-semibold text-premium-gold mt-1">{formatCurrency(order.total)}</p>
            </div>
            <ChevronRight size={18} className="text-premium-navy/20 shrink-0" />
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
      <Helmet><title>{`${id ? 'Order Details' : 'My Orders'} — Divya Foods`}</title></Helmet>
      {id ? <OrderDetail orderId={id} /> : <OrdersList />}
    </>
  )
}
