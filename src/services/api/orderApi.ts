import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveryAddress {
  label: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  pincode: string
}

export interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
}

export interface TrackingEvent {
  status: string
  timestamp: string
  note?: string
}

export type DeliverySlot =
  | { type: 'express' }
  | { type: 'scheduled'; date: string; timeWindow: string }

// Granular courier states — layered on top of `Order.status`, independent of it.
export type DeliveryStatus =
  | 'packed' | 'ready_for_pickup' | 'picked_up' | 'in_transit'
  | 'near_delivery' | 'delivered' | 'failed' | 'cancelled'

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  'packed', 'ready_for_pickup', 'picked_up', 'in_transit',
  'near_delivery', 'delivered', 'failed', 'cancelled',
]

export interface DeliveryInfo {
  provider?: string
  trackingId?: string
  bookingId?: string
  partnerName?: string
  driverId?: string
  driverName?: string
  driverPhone?: string
  vehicleNumber?: string
  vehicleType?: string
  deliveryCharge?: number
  notes?: string
  deliveryStatus: DeliveryStatus
  estimatedDeliveryAt?: string
  proofOfDeliveryUrl?: string
  deliveredAt?: string
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  razorpayOrderId?: string
  razorpayPaymentId?: string
  deliveryAddress: DeliveryAddress
  items: OrderItem[]
  subtotal: number
  deliveryCharge: number
  discount: number
  total: number
  couponCode?: string
  notes?: string
  trackingTimeline: TrackingEvent[]
  delivery: DeliveryInfo | null
  deliverySlot: DeliverySlot | null
  createdAt: string
  updatedAt: string
}

export interface InitiateOrderResponse {
  orderId: string
  orderNumber: string
  razorpayOrderId: string
  razorpayKeyId: string
  amount: number
  currency: string
}

export interface PaginatedOrders {
  data: Order[]
  total: number
  page: number
  totalPages: number
}

// Cart item shape from Redux store
interface CartItemPayload {
  productId: string
  name: string
  price: number
  quantity: number
  image: string | null
  maxQuantity: number
}

export interface GuestDetails {
  name: string
  email: string
  phone: string
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const orderApi = {
  /**
   * Step 1 — create our order doc + Razorpay order.
   * Returns the Razorpay order ID and public key for the payment popup.
   */
  initiate: async (
    address: DeliveryAddress,
    items: CartItemPayload[],
    couponCode?: string,
    notes?: string,
    deliverySlot?: DeliverySlot,
    giftCardCode?: string,
  ): Promise<InitiateOrderResponse> => {
    const { data } = await axiosInstance.post<ApiResponse<InitiateOrderResponse>>('/orders', {
      delivery_address: {
        label:         address.label,
        full_name:     address.fullName,
        phone:         address.phone,
        address_line1: address.addressLine1,
        address_line2: address.addressLine2,
        city:          address.city,
        state:         address.state,
        pincode:       address.pincode,
      },
      payment_method: 'razorpay',
      coupon_code:    couponCode || null,
      gift_card_code: giftCardCode || null,
      notes:          notes || '',
      items:          items.map(i => ({
        productId:   i.productId,
        name:        i.name,
        price:       i.price,
        quantity:    i.quantity,
        image:       i.image || '',
        maxQuantity: i.maxQuantity,
      })),
      delivery_slot: deliverySlot ?? null,
    })
    return data.data
  },

  /** Same as initiate(), but for an unauthenticated guest — no token required. */
  initiateGuest: async (
    guest: GuestDetails,
    address: DeliveryAddress,
    items: CartItemPayload[],
    couponCode?: string,
    notes?: string,
    deliverySlot?: DeliverySlot,
    giftCardCode?: string,
  ): Promise<InitiateOrderResponse> => {
    const { data } = await axiosInstance.post<ApiResponse<InitiateOrderResponse>>('/orders/guest', {
      name:  guest.name,
      email: guest.email,
      phone: guest.phone,
      delivery_address: {
        label:         address.label,
        full_name:     address.fullName,
        phone:         address.phone,
        address_line1: address.addressLine1,
        address_line2: address.addressLine2,
        city:          address.city,
        state:         address.state,
        pincode:       address.pincode,
      },
      payment_method: 'razorpay',
      coupon_code:    couponCode || null,
      gift_card_code: giftCardCode || null,
      notes:          notes || '',
      items:          items.map(i => ({
        productId:   i.productId,
        name:        i.name,
        price:       i.price,
        quantity:    i.quantity,
        image:       i.image || '',
        maxQuantity: i.maxQuantity,
      })),
      delivery_slot: deliverySlot ?? null,
    })
    return data.data
  },

  verifyGuestPayment: async (
    orderId: string,
    email: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<Order> => {
    const { data } = await axiosInstance.post<ApiResponse<Order>>('/orders/guest/verify', {
      order_id:             orderId,
      email,
      razorpay_order_id:    razorpayOrderId,
      razorpay_payment_id:  razorpayPaymentId,
      razorpay_signature:   razorpaySignature,
    })
    return data.data
  },

  /** Guests have no login — order number + email together prove ownership. */
  trackGuestOrder: async (orderNumber: string, email: string): Promise<Order> => {
    const { data } = await axiosInstance.get<ApiResponse<Order>>('/orders/guest/track', {
      params: { order_number: orderNumber, email },
    })
    return data.data
  },

  /**
   * Step 2 — verify Razorpay payment signature after popup closes.
   * Backend does HMAC-SHA256 check; on success marks order confirmed + clears cart.
   */
  verifyPayment: async (
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<Order> => {
    const { data } = await axiosInstance.post<ApiResponse<Order>>('/orders/verify', {
      order_id:             orderId,
      razorpay_order_id:    razorpayOrderId,
      razorpay_payment_id:  razorpayPaymentId,
      razorpay_signature:   razorpaySignature,
    })
    return data.data
  },

  getMyOrders: async (page = 1): Promise<PaginatedOrders> => {
    const { data } = await axiosInstance.get<ApiResponse<PaginatedOrders>>(`/orders?page=${page}`)
    return data.data
  },

  getById: async (orderId: string): Promise<Order> => {
    const { data } = await axiosInstance.get<ApiResponse<Order>>(`/orders/${orderId}`)
    return data.data
  },

  /** Triggers a browser download of the order's invoice PDF. */
  downloadInvoice: async (orderId: string, orderNumber: string): Promise<void> => {
    const { data } = await axiosInstance.get(`/orders/${orderId}/invoice`, { responseType: 'blob' })
    const url = URL.createObjectURL(data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${orderNumber}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  },

  /** Opens the invoice PDF in a new tab — the browser's native PDF viewer has a print button. */
  printInvoice: async (orderId: string): Promise<void> => {
    const { data } = await axiosInstance.get(`/orders/${orderId}/invoice`, { responseType: 'blob' })
    const url = URL.createObjectURL(data as Blob)
    window.open(url, '_blank')
  },

  emailInvoice: async (orderId: string): Promise<string> => {
    const { data } = await axiosInstance.post<{ success: boolean; message: string }>(`/orders/${orderId}/invoice/email`)
    return data.message
  },
}
