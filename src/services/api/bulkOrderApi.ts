import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BulkOrderStatus = 'new' | 'contacted' | 'quoted' | 'closed'

export interface BulkOrderItemInput {
  productName: string
  quantity: number
}

export interface BulkOrderRequestPayload {
  company_name?: string
  contact_name: string
  email: string
  phone: string
  items: BulkOrderItemInput[]
  message?: string
}

export interface BulkOrderRequest {
  id: string
  companyName: string | null
  contactName: string
  email: string
  phone: string
  items: BulkOrderItemInput[]
  message: string | null
  status: BulkOrderStatus
  adminNotes: string | null
  createdAt: string
  updatedAt: string
}

interface PaginatedBulkOrders {
  data: BulkOrderRequest[]
  total: number
  page: number
  limit: number
}

// ─── Public ───────────────────────────────────────────────────────────────────

export const bulkOrderApi = {
  submit: async (payload: BulkOrderRequestPayload): Promise<BulkOrderRequest> => {
    const { data } = await axiosInstance.post<ApiResponse<BulkOrderRequest>>('/bulk-orders', payload)
    return data.data
  },
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminBulkOrderApi = {
  list: async (status?: BulkOrderStatus, page = 1, limit = 20): Promise<PaginatedBulkOrders> => {
    const { data } = await axiosInstance.get<PaginatedBulkOrders>('/admin/bulk-orders', {
      params: { status: status || undefined, page, limit },
    })
    return data
  },

  update: async (id: string, payload: { status?: BulkOrderStatus; admin_notes?: string }): Promise<BulkOrderRequest> => {
    const { data } = await axiosInstance.put<ApiResponse<BulkOrderRequest>>(`/admin/bulk-orders/${id}`, payload)
    return data.data
  },
}
