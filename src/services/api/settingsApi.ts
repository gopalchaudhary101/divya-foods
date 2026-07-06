import axiosInstance from './axiosInstance'
import type { SiteSettings, ApiResponse } from '@/types'

export const settingsApi = {
  /** Public business/legal info (GST, FSSAI) — powers Footer, About and Checkout. */
  get: async (): Promise<SiteSettings> => {
    const { data } = await axiosInstance.get<ApiResponse<SiteSettings>>('/settings')
    return data.data
  },
}

export const adminSettingsApi = {
  get: async (): Promise<SiteSettings> => {
    const { data } = await axiosInstance.get<ApiResponse<SiteSettings>>('/admin/settings')
    return data.data
  },
  update: async (payload: Partial<SiteSettings>): Promise<SiteSettings> => {
    const { data } = await axiosInstance.put<ApiResponse<SiteSettings>>('/admin/settings', payload)
    return data.data
  },
}
