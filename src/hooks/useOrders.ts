import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { orderApi, type CreateOrderRequest } from '@/services/api/orderApi'
import { queryKeys } from '@/services/queryKeys'
import { getErrorMessage } from '@/utils/apiError'

/** Paginated order history for the logged-in user. */
export function useOrders(page = 1) {
  return useQuery({
    queryKey: [...queryKeys.orders.all(), page],
    queryFn: () => orderApi.getOrders(page),
    staleTime: 1000 * 60 * 2,
  })
}

/** Single order detail — for the order tracking page. */
export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => orderApi.getOrderById(id),
    enabled: Boolean(id),
    staleTime: 1000 * 30, // refresh every 30 seconds for live tracking
    refetchInterval: 1000 * 30,
  })
}

/**
 * Create a new order from the current cart.
 * On success: invalidates orders cache so the list refreshes.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrderRequest) => orderApi.createOrder(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/** Cancel an order (only pending/confirmed orders). */
export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => orderApi.cancelOrder(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() })
      toast.success('Order cancelled successfully')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
