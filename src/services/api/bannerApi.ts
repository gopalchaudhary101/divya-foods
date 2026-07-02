import axiosInstance from './axiosInstance'
import type { Banner, ApiResponse } from '@/types'

export const bannerApi = {
  /** Active banners sorted by display order — powers the homepage hero carousel. */
  getActive: async (): Promise<Banner[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Banner[]>>('/banners')
    return data.data
  },
}
