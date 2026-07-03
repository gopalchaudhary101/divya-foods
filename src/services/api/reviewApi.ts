import axiosInstance from './axiosInstance'
import type { Review, ApiResponse, PaginatedResponse } from '@/types'

export interface CreateReviewRequest {
  productId: string
  rating: number
  comment: string
}

export interface CanReviewResponse {
  canReview: boolean
  reason: 'already_reviewed' | 'no_purchase' | null
  reviewId?: string
}

export const reviewApi = {
  getByProduct: async (productId: string, page = 1): Promise<PaginatedResponse<Review>> => {
    const { data } = await axiosInstance.get<PaginatedResponse<Review>>(`/reviews/${productId}`, {
      params: { page, limit: 10 },
    })
    return data
  },

  canReview: async (productId: string): Promise<CanReviewResponse> => {
    const { data } = await axiosInstance.get<ApiResponse<CanReviewResponse>>(
      `/reviews/can-review/${productId}`,
    )
    return data.data
  },

  create: async (payload: CreateReviewRequest): Promise<Review> => {
    const { data } = await axiosInstance.post<ApiResponse<Review>>('/reviews', {
      product_id: payload.productId,
      rating:     payload.rating,
      comment:    payload.comment,
    })
    return data.data
  },

  delete: async (reviewId: string): Promise<void> => {
    await axiosInstance.delete(`/reviews/${reviewId}`)
  },
}
