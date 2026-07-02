import axiosInstance from './axiosInstance'
import type { Review, ApiResponse, PaginatedResponse } from '@/types'

export interface CreateReviewRequest {
  productId: string
  rating: number
  comment: string
}

export const reviewApi = {
  /** All reviews for a product — paginated. */
  getByProduct: async (productId: string, page = 1): Promise<PaginatedResponse<Review>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<Review>>(`/reviews/${productId}`, {
      params: { page, limit: 10 },
    })
    return data
  },

  /** Submit a review (only for verified purchasers). */
  create: async (payload: CreateReviewRequest): Promise<Review> => {
    const { data } = await axiosInstance.post<ApiResponse<Review>>('/reviews', {
      product_id: payload.productId,
      rating: payload.rating,
      comment: payload.comment,
    })
    return data.data
  },

  /** Delete the logged-in user's own review. */
  delete: async (reviewId: string): Promise<void> => {
    await axiosInstance.delete(`/reviews/${reviewId}`)
  },
}
