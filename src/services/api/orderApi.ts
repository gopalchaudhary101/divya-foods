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
      notes:          notes || '',
      items:          items.map(i => ({
        productId:   i.productId,
        name:        i.name,
        price:       i.price,
        quantity:    i.quantity,
        image:       i.image || '',
        maxQuantity: i.maxQuantity,
      })),
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
}
