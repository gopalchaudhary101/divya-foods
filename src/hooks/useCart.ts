import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { cartApi, type CartItemData } from '@/services/api/cartApi'
import { queryKeys } from '@/services/queryKeys'
import { useAppSelector } from '@/hooks/useAppSelector'
import { getErrorMessage } from '@/utils/apiError'

/**
 * Fetch the server-side cart for the authenticated user.
 * Only runs when the user is logged in (enabled: isAuthenticated).
 */
export function useCartQuery() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  return useQuery({
    queryKey: queryKeys.cart.all(),
    queryFn: cartApi.getCart,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2,
  })
}

/**
 * Sync the local Redux cart to the server after login.
 * Replaces the server cart with whatever is in Redux — client wins.
 */
export function useSyncCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: CartItemData[]) => cartApi.syncCart(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/**
 * Add a product to the server cart.
 * Takes the full item object because the backend stores a price/image snapshot.
 */
export function useAddToCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: CartItemData) => cartApi.addItem(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/**
 * Update an item's quantity in the server cart.
 */
export function useUpdateCartItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      cartApi.updateItem(productId, quantity),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/**
 * Remove a single item from the server cart.
 */
export function useRemoveFromCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productId: string) => cartApi.removeItem(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
