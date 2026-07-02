import axiosInstance from './axiosInstance'
import type { Category, ApiResponse } from '@/types'

export const categoryApi = {
  /** All active categories — homepage category grid, navbar mega-menu. */
  getAll: async (): Promise<Category[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Category[]>>('/categories')
    return data.data
  },

  /** Single category by slug — powers the category detail page. */
  getBySlug: async (slug: string): Promise<Category> => {
    const { data } = await axiosInstance.get<ApiResponse<Category>>(`/categories/${slug}`)
    return data.data
  },
}
