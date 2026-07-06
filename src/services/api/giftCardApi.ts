import axiosInstance from './axiosInstance'
import type { ApiResponse } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GiftCard {
  id: string
  code: string
  initialValue: number
  balance: number
  isActive: boolean
  issuedToEmail: string | null
  notes: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GiftCardIssuePayload {
  value: number
  code?: string
  issued_to_email?: string
  notes?: string
  expires_at?: string
}

interface PaginatedGiftCards {
  data: GiftCard[]
  total: number
  page: number
  limit: number
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminGiftCardApi = {
  list: async (page = 1, limit = 20): Promise<PaginatedGiftCards> => {
    const { data } = await axiosInstance.get<PaginatedGiftCards>('/admin/gift-cards', {
      params: { page, limit },
    })
    return data
  },

  issue: async (payload: GiftCardIssuePayload): Promise<GiftCard> => {
    const { data } = await axiosInstance.post<ApiResponse<GiftCard>>('/admin/gift-cards', payload)
    return data.data
  },

  update: async (id: string, payload: { is_active?: boolean; notes?: string }): Promise<GiftCard> => {
    const { data } = await axiosInstance.put<ApiResponse<GiftCard>>(`/admin/gift-cards/${id}`, payload)
    return data.data
  },
}
