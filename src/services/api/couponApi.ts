import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

export interface CouponValidateResponse {
  valid: boolean
  discountAmount: number
  message: string
}

export const couponApi = {
  /**
   * Validate a coupon code against an order amount.
   * Called when the user types a code in the checkout coupon field.
   * Returns the discount amount if valid.
   */
  validate: async (code: string, orderAmount: number): Promise<CouponValidateResponse> => {
    const { data } = await axiosInstance.post<ApiResponse<CouponValidateResponse>>(
      '/coupons/validate',
      { code: code.toUpperCase(), order_amount: orderAmount }
    )
    return data.data
  },
}
