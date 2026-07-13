import axiosInstance from './axiosInstance'
import type { ApiResponse, WhatsAppConfig, WhatsAppAdminConfig, WhatsAppAnalytics } from '@/types'

export interface TrackShareRequest {
  productId: string
  productName: string
  source: 'product_card' | 'product_detail' | 'cart' | 'order'
}

export interface WhatsAppConfigUpdate {
  enabled?: boolean
  phoneNumber?: string
  productMessageTemplate?: string
  cartMessageTemplate?: string
  orderMessageTemplate?: string
}

export const whatsappApi = {
  /** Public config powering every "Share on WhatsApp" button on the site. */
  getConfig: async (): Promise<WhatsAppConfig> => {
    const { data } = await axiosInstance.get<ApiResponse<WhatsAppConfig>>('/whatsapp/config')
    return data.data
  },

  /** Fire-and-forget share-click logging for the admin analytics view. */
  trackShare: async (payload: TrackShareRequest): Promise<void> => {
    await axiosInstance.post('/whatsapp/track-share', payload)
  },
}

export const adminWhatsappApi = {
  getConfig: async (): Promise<WhatsAppAdminConfig> => {
    const { data } = await axiosInstance.get<ApiResponse<WhatsAppAdminConfig>>('/admin/whatsapp/config')
    return data.data
  },

  updateConfig: async (payload: WhatsAppConfigUpdate): Promise<WhatsAppAdminConfig> => {
    const { data } = await axiosInstance.put<ApiResponse<WhatsAppAdminConfig>>('/admin/whatsapp/config', payload)
    return data.data
  },

  getAnalytics: async (): Promise<WhatsAppAnalytics> => {
    const { data } = await axiosInstance.get<ApiResponse<WhatsAppAnalytics>>('/admin/whatsapp/analytics')
    return data.data
  },
}
