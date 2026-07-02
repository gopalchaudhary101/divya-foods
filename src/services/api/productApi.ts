import axiosInstance from './axiosInstance'
import type { Product, PaginatedResponse, ApiResponse } from '@/types'

// ─── Request / filter types ───────────────────────────────────────────────────

export interface ProductListParams {
  page?: number
  limit?: number
  category?: string
  origin?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'popular'
  search?: string
}

// ─── API functions ────────────────────────────────────────────────────────────

export const productApi = {
  /**
   * Paginated + filtered product listing.
   * Powers: /products page, category pages, search results.
   */
  getList: async (params: ProductListParams = {}): Promise<PaginatedResponse<Product>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<Product>>('/products', { params })
    return data
  },

  /**
   * Single product by URL slug.
   * Powers: /products/:slug detail page.
   */
  getBySlug: async (slug: string): Promise<Product> => {
    const { data } = await axiosInstance.get<ApiResponse<Product>>(`/products/${slug}`)
    return data.data
  },

  /**
   * Products marked is_featured=true — homepage Featured section.
   */
  getFeatured: async (): Promise<Product[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Product[]>>('/products/featured')
    return data.data
  },

  /**
   * Products marked is_best_seller=true — homepage Best Sellers section.
   */
  getBestSellers: async (): Promise<Product[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Product[]>>('/products/best-sellers')
    return data.data
  },

  /**
   * Full-text search — powers the search bar.
   */
  search: async (query: string): Promise<Product[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Product[]>>('/products/search', {
      params: { q: query },
    })
    return data.data
  },

  /**
   * Related products for the detail page sidebar.
   */
  getRelated: async (productId: string): Promise<Product[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Product[]>>(
      `/products/${productId}/related`
    )
    return data.data
  },
}
