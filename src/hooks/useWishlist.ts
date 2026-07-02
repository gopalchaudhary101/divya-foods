import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { wishlistApi } from '@/services/api/wishlistApi'
import { queryKeys } from '@/services/queryKeys'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { toggleWishlist } from '@/features/wishlist/wishlistSlice'
import { getErrorMessage } from '@/utils/apiError'

/**
 * Returns the server-side wishlist (full product objects) for authenticated users.
 * Unauthenticated users use Redux store only (no API call).
 */
export function useWishlistQuery() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  return useQuery({
    queryKey: queryKeys.wishlist.all(),
    queryFn: wishlistApi.getWishlist,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Toggle a product in/out of the wishlist.
 *
 * For authenticated users: syncs with the API and invalidates the query cache.
 * For unauthenticated users: updates only the Redux store (persists in memory).
 */
export function useToggleWishlist() {
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const localWishlist = useAppSelector((s) => s.wishlist.productIds)

  const apiMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (localWishlist.includes(productId)) {
        await wishlistApi.removeFromWishlist(productId)
      } else {
        await wishlistApi.addToWishlist(productId)
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all() }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (productId: string) => {
    // Always update Redux store for instant UI feedback
    dispatch(toggleWishlist(productId))

    // Authenticated: also sync to server
    if (isAuthenticated) {
      apiMutation.mutate(productId)
    }
  }
}

/**
 * Returns true if a product is in the wishlist.
 * Works for both authenticated and unauthenticated users.
 */
export function useIsWishlisted(productId: string): boolean {
  const localIds = useAppSelector((s) => s.wishlist.productIds)
  return localIds.includes(productId)
}
