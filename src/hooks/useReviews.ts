import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { reviewApi, type CreateReviewRequest } from '@/services/api/reviewApi'
import { queryKeys } from '@/services/queryKeys'
import { getErrorMessage } from '@/utils/apiError'
import { useAppSelector } from '@/hooks/useAppSelector'

export function useReviews(productId: string, page = 1) {
  return useQuery({
    queryKey: [...queryKeys.reviews.byProduct(productId), page],
    queryFn:  () => reviewApi.getByProduct(productId, page),
    enabled:  Boolean(productId),
    staleTime: 1000 * 60 * 5,
  })
}

export function useCanReview(productId: string) {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated)
  return useQuery({
    queryKey: queryKeys.reviews.canReview(productId),
    queryFn:  () => reviewApi.canReview(productId),
    enabled:  Boolean(productId) && isAuthenticated,
    staleTime: 0,
  })
}

export function useSubmitReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateReviewRequest) => reviewApi.create(payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(vars.productId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.canReview(vars.productId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      toast.success('Review submitted!')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useDeleteReview(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) => reviewApi.delete(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byProduct(productId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.reviews.canReview(productId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      toast.success('Review deleted')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
