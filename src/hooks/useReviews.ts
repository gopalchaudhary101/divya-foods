import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { reviewApi, type CreateReviewRequest } from '@/services/api/reviewApi'
import { queryKeys } from '@/services/queryKeys'
import { getErrorMessage } from '@/utils/apiError'

/** All reviews for a product — paginated. Powers the review section of product detail. */
export function useReviews(productId: string, page = 1) {
  return useQuery({
    queryKey: [...queryKeys.reviews.byProduct(productId), page],
    queryFn: () => reviewApi.getByProduct(productId, page),
    enabled: Boolean(productId),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Submit a product review.
 * On success: invalidates the product's review cache so the new review appears,
 * and invalidates the product query so the updated rating shows.
 */
export function useSubmitReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateReviewRequest) => reviewApi.create(payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(vars.productId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      toast.success('Review submitted successfully!')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
