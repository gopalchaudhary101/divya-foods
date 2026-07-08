import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReturnReason = 'wrong_item' | 'damaged_or_spoiled' | 'missing_item' | 'other'
export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded'

export interface ReturnLineItem {
  productId: string
  name: string
  price: number
  quantity: number
}

export interface ReturnItemInput {
  productId: string
  quantity: number
}

export interface ReturnRequestRecord {
  id: string
  orderId: string
  orderNumber: string
  userId: string
  reason: ReturnReason
  note: string | null
  items: ReturnLineItem[]
  refundAmount: number
  status: ReturnStatus
  adminNote: string | null
  razorpayRefundId: string | null
  /** The order's payment method at request time — 'razorpay' orders can be
   *  auto-refunded; anything else (e.g. 'cod') needs a manual refund record. */
  orderPaymentMethod: string | null
  refundMethod: 'razorpay' | 'manual' | null
  refundReference: string | null
  requestedAt: string
  updatedAt: string
  resolvedAt: string | null
}

interface PaginatedReturns {
  data: ReturnRequestRecord[]
  total: number
  page: number
  totalPages: number
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export const returnApi = {
  request: async (
    orderId: string,
    reason: ReturnReason,
    note: string,
    items: ReturnItemInput[],
  ): Promise<ReturnRequestRecord> => {
    const { data } = await axiosInstance.post<ApiResponse<ReturnRequestRecord>>(
      `/orders/${orderId}/return-request`,
      { reason, note, items },
    )
    return data.data
  },

  /** Returns null if no return request exists for this order yet (404). */
  getForOrder: async (orderId: string): Promise<ReturnRequestRecord | null> => {
    try {
      const { data } = await axiosInstance.get<ApiResponse<ReturnRequestRecord>>(
        `/orders/${orderId}/return-request`,
      )
      return data.data
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) return null
      throw err
    }
  },
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminReturnApi = {
  list: async (
    status?: ReturnStatus | '',
    search?: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedReturns> => {
    const { data } = await axiosInstance.get<PaginatedReturns>('/admin/returns', {
      params: { status: status || undefined, search: search || undefined, page, limit },
    })
    return data
  },

  approve: async (id: string, note?: string): Promise<ReturnRequestRecord> => {
    const { data } = await axiosInstance.put<ApiResponse<ReturnRequestRecord>>(
      `/admin/returns/${id}/approve`,
      { note: note || '' },
    )
    return data.data
  },

  /** For orders that can't be auto-refunded via Razorpay (most commonly COD) —
   *  records a refund the admin already completed some other way. */
  approveManual: async (id: string, reference: string, note?: string): Promise<ReturnRequestRecord> => {
    const { data } = await axiosInstance.put<ApiResponse<ReturnRequestRecord>>(
      `/admin/returns/${id}/approve-manual`,
      { reference, note: note || '' },
    )
    return data.data
  },

  reject: async (id: string, note: string): Promise<ReturnRequestRecord> => {
    const { data } = await axiosInstance.put<ApiResponse<ReturnRequestRecord>>(
      `/admin/returns/${id}/reject`,
      { note },
    )
    return data.data
  },
}
