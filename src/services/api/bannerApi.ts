import axiosInstance from './axiosInstance'
import type { Banner, ApiResponse } from '@/types'

export const bannerApi = {
  /** Active banners sorted by display order — powers the homepage hero carousel. */
  getActive: async (): Promise<Banner[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Banner[]>>('/banners')
    return data.data
  },
}

export interface BannerUpsertPayload {
  title: string
  subtitle?: string | null
  image: string
  link?: string | null
  isActive: boolean
  order: number
}

export const adminBannerApi = {
  list: async (): Promise<Banner[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Banner[]>>('/admin/banners')
    return data.data
  },

  create: async (payload: BannerUpsertPayload): Promise<Banner> => {
    const { data } = await axiosInstance.post<ApiResponse<Banner>>('/admin/banners', payload)
    return data.data
  },

  update: async (id: string, payload: BannerUpsertPayload): Promise<Banner> => {
    const { data } = await axiosInstance.put<ApiResponse<Banner>>(`/admin/banners/${id}`, payload)
    return data.data
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/admin/banners/${id}`)
  },
}
