// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: 'customer' | 'admin' | 'driver'
  avatar?: string
  date_of_birth?: string | null
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
  salePrice?: number
  saleEndsAt?: string
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

// ─── Site Settings ────────────────────────────────────────────────────────────
export interface SiteSettings {
  businessName: string
  gstNumber: string
  fssaiNumber: string
  // Image-upload limits — admin-only, not present on the public /settings response
  maxUploadSizeMB?: number
  maxImageDimension?: number
  compressionQuality?: 'auto:eco' | 'auto:good' | 'auto:best'
  allowedFormats?: string[]
  enableWebP?: boolean
  enableAVIF?: boolean
  thumbnailSizes?: number[]
}

// ─── Q&A ──────────────────────────────────────────────────────────────────────
export interface QA {
  id: string
  productId: string
  userId: string
  userName: string
  question: string
  answer: string | null
  answeredAt: string | null
  createdAt: string
}

// ─── Subscription ─────────────────────────────────────────────────────────────
export type SubscriptionFrequency = 'weekly' | 'biweekly' | 'monthly'
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

export interface Subscription {
  id: string
  productId: string
  productName: string
  productImage?: string
  productPrice: number
  quantity: number
  frequency: SubscriptionFrequency
  status: SubscriptionStatus
  discountPct: number
  nextDelivery: string | null
  createdAt: string
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────
export interface LoyaltyBalance {
  earned: number
  bonusPoints: number
  redeemed: number
  available: number
  discountPerPoint: number
  minRedeem: number
  birthdayBonusGranted: boolean
  birthdayBonusPoints: number
  recentOrders: {
    orderNumber: string
    total: number
    points: number
    date: string
  }[]
}

// ─── Membership ───────────────────────────────────────────────────────────────
export type MembershipTier = 'Silver' | 'Gold' | 'Platinum'

export interface MembershipInfo {
  tier: MembershipTier
  lifetimeSpend: number
  nextTier: MembershipTier | null
  amountToNextTier: number | null
  perks: {
    freeDelivery: boolean
    freeDeliveryAbove: number | null
  }
}
