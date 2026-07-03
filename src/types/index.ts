// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: 'customer' | 'admin'
  avatar?: string
  createdAt: string
}

// ─── Product ──────────────────────────────────────────────────────────────────
export interface Product {
  id: string
  name: string
  slug: string
  description: string
  price: number
  originalPrice?: number
  images: string[]
  category: string
  subcategory?: string
  brand?: string
  origin?: string
  weight?: string
  inStock: boolean
  stockQuantity: number
  rating: number
  reviewCount: number
  tags: string[]
  isFeatured: boolean
  isBestSeller: boolean
  createdAt: string
}

// ─── Category ─────────────────────────────────────────────────────────────────
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image: string
  productCount: number
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
  maxQuantity: number
}

// ─── Order ────────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type PaymentMethod = 'razorpay' | 'cod'

export interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
}

export interface Address {
  id?: string
  label: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  pincode: string
  isDefault?: boolean
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  deliveryAddress: Address
  subtotal: number
  deliveryCharge: number
  discount: number
  total: number
  couponCode?: string
  razorpayOrderId?: string
  createdAt: string
  updatedAt: string
}

// ─── Review ───────────────────────────────────────────────────────────────────
export interface Review {
  id: string
  productId: string
  userId: string
  userName: string
  rating: number
  comment: string
  isVerifiedPurchase: boolean
  createdAt: string
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  message: string
  statusCode: number
  errors?: Record<string, string[]>
}

// ─── Coupon ───────────────────────────────────────────────────────────────────
export interface Coupon {
  id: string
  code: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minOrderAmount: number
  maxUses: number
  usedCount: number
  expiresAt: string
  isActive: boolean
}

// ─── Banner ───────────────────────────────────────────────────────────────────
export interface Banner {
  id: string
  title: string
  subtitle?: string
  image: string
  link?: string
  isActive: boolean
  order: number
}
