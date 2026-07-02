import axiosInstance from './axiosInstance'
import type { Product, ApiResponse } from '@/types'

export const wishlistApi = {
  /** Full wishlist with product details (for the wishlist page). */
  getWishlist: async (): Promise<Product[]> => {
    const { data } = await axiosInstance.get<ApiResponse<Product[]>>('/users/wishlist')
    return data.data
  },

  /** Add a product to the wishlist. */
  addToWishlist: async (productId: string): Promise<void> => {
    await axiosInstance.post('/users/wishlist', { product_id: productId })
  },

  /** Remove a product from the wishlist. */
  removeFromWishlist: async (productId: string): Promise<void> => {
    await axiosInstance.delete(`/users/wishlist/${productId}`)
  },
}
