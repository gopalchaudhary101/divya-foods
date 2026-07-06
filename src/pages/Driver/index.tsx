import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, Package, MapPin, Phone, LogOut, CheckCircle, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { driverApi } from '@/services/api/driverApi'
import { uploadApi } from '@/services/api/uploadApi'
import { DELIVERY_STATUSES, type DeliveryStatus, type Order } from '@/services/api/orderApi'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  packed: 'Packed', ready_for_pickup: 'Ready for Pickup', picked_up: 'Picked Up',
  in_transit: 'In Transit', near_delivery: 'Arriving Soon', delivered: 'Delivered',
  failed: 'Delivery Failed', cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  packed: 'text-ocean-600 bg-ocean-50 dark:bg-ocean-900/30',
  ready_for_pickup: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  picked_up: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
  in_transit: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  near_delivery: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  delivered: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  failed: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  cancelled: 'text-red-400 bg-red-50 dark:bg-red-900/20',
}

// The natural forward progression a delivery normally follows — used to suggest the "next step" button.
const FORWARD_SEQUENCE: DeliveryStatus[] = [
  'packed', 'ready_for_pickup', 'picked_up', 'in_transit', 'near_delivery', 'delivered',
]

function nextStatus(current: DeliveryStatus): DeliveryStatus | null {
  const idx = FORWARD_SEQUENCE.indexOf(current)
  if (idx === -1 || idx === FORWARD_SEQUENCE.length - 1) return null
  return FORWARD_SEQUENCE[idx + 1]
}

function OrderCard({ order }: { order: Order }) {
  const queryClient = useQueryClient()
  const [uploadingPod, setUploadingPod] = useState(false)
  const delivery = order.delivery!
  const status = delivery.deliveryStatus
  const upcoming = nextStatus(status)

  const mutation = useMutation({
    mutationFn: ({ newStatus, podUrl }: { newStatus: DeliveryStatus; podUrl?: string }) =>
      driverApi.updateStatus(order.id, newStatus, undefined, podUrl),
    onSuccess: () => {
      toast.success('Status updated')
      queryClient.invalidateQueries({ queryKey: ['driver', 'orders'] })
    },
    onError: () => toast.error('Failed to update status'),
  })

  async function handleAdvance(target: DeliveryStatus) {
    if (target === 'delivered') {
      // Proof of delivery is required before marking an order delivered.
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/jpeg,image/png,image/webp'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        setUploadingPod(true)
        try {
          const { url } = await uploadApi.image(file)
          mutation.mutate({ newStatus: target, podUrl: url })
        } catch {
          toast.error('Failed to upload proof of delivery')
        } finally {
          setUploadingPod(false)
        }
      }
      input.click()
      return
    }
    mutation.mutate({ newStatus: target })
  }

  return (
    <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="font-semibold text-ocean-900 dark:text-white">{order.orderNumber}</p>
          <p className="text-xs text-ocean-400">{formatDate(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {formatCurrency(order.total)}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      <div className="bg-ocean-50 dark:bg-ocean-800 rounded-xl p-3 mb-4 text-sm text-ocean-700 dark:text-ocean-200">
        <p className="flex items-start gap-2">
          <MapPin size={14} className="text-ocean-400 mt-0.5 shrink-0" />
          <span>
            {order.deliveryAddress.fullName}<br />
            {order.deliveryAddress.addressLine1}{order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}<br />
            {order.deliveryAddress.city}, {order.deliveryAddress.state} — {order.deliveryAddress.pincode}
          </span>
        </p>
        <a href={`tel:${order.deliveryAddress.phone}`} className="flex items-center gap-2 mt-2 text-ocean-600 dark:text-ocean-300 hover:text-ocean-800">
          <Phone size={13} /> {order.deliveryAddress.phone}
        </a>
      </div>

      {status !== 'delivered' && status !== 'cancelled' && status !== 'failed' && (
        <div className="flex flex-wrap gap-2">
          {upcoming && (
            <Button
              size="sm" variant="primary"
              loading={mutation.isPending || uploadingPod}
              leftIcon={upcoming === 'delivered' ? <Camera size={13} /> : <CheckCircle size={13} />}
              onClick={() => handleAdvance(upcoming)}
            >
              Mark {STATUS_LABELS[upcoming]}
            </Button>
          )}
          <Button
            size="sm" variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ newStatus: 'failed' })}
          >
            Report Failed Delivery
          </Button>
        </div>
      )}
    </div>
  )
}

export default function DriverDashboardPage() {
  const { user, logout } = useAuth()
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['driver', 'orders', statusFilter],
    queryFn: () => driverApi.getMyOrders(statusFilter || undefined),
  })

  const orders = data?.data ?? []

  return (
    <>
      <Helmet><title>Driver Dashboard — Divya Luxury Seafoods</title></Helmet>
      <div className="min-h-screen bg-ocean-50 dark:bg-ocean-950">
        <div className="bg-white dark:bg-ocean-900 border-b border-ocean-100 dark:border-ocean-800 px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck size={20} className="text-ocean-500" />
            <div>
              <h1 className="font-display text-lg font-semibold text-ocean-900 dark:text-white">Driver Dashboard</h1>
              <p className="text-xs text-ocean-400">Welcome, {user?.name}</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs font-medium text-ocean-500 hover:text-red-500 transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
            <button
              onClick={() => setStatusFilter('')}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border ${statusFilter === '' ? 'bg-ocean-700 text-white border-ocean-700' : 'border-ocean-200 text-ocean-500 dark:border-ocean-700'}`}
            >
              All
            </button>
            {DELIVERY_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border whitespace-nowrap ${statusFilter === s ? 'bg-ocean-700 text-white border-ocean-700' : 'border-ocean-200 text-ocean-500 dark:border-ocean-700'}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <div className="w-8 h-8 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-ocean-400">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No orders assigned right now</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
