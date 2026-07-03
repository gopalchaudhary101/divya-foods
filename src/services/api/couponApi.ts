import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CouponValidateResponse {
  valid: boolean
  discountAmount: number
  message: string
}

export interface Coupon {
  id: string
  code: string
  discountType: 'percentage' | 'flat'
  discountValue: number
  minOrderValue: number
  maxDiscount?: number | null
  isActive: boolean
  expiresAt?: string | null
  usageLimit?: number | null
  usedCount: number
  createdAt: string
}

export interface CouponUpsertPayload {
  code: string
  discountType: 'percentage' | 'flat'
  discountValue: number
  minOrderValue: number
  maxDiscount?: number | null
  isActive: boolean
  expiresAt?: string | null
  usageLimit?: number | null
}

// ─── Public ───────────────────────────────────────────────────────────────────

export const couponApi = {
  validate: async (code: string, orderAmount: number): Promise<CouponValidateResponse> => {
    const { data } = await axiosInstance.post<ApiResponse<CouponValidateResponse>>(
      '/coupons/validate',
      { code: code.toUpperCase(), order_amount: orderAmount }
    )
    return data.data
  },
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminCouponApi = {
  list: async (): Promise<Coupon[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Coupon[]>>('/admin/coupons')
    return data.data
  },

  create: async (payload: CouponUpsertPayload): Promise<Coupon> => {
    const { data } = await axiosInstance.post<ApiResponse<Coupon>>('/admin/coupons', payload)
    return data.data
  },

  update: async (id: string, payload: CouponUpsertPayload): Promise<Coupon> => {
    const { data } = await axiosInstance.put<ApiResponse<Coupon>>(`/admin/coupons/${id}`, payload)
    return data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/admin/coupons/${id}`)
  },
}
