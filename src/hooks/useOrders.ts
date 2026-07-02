import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { orderApi } from '@/services/api/orderApi'
import { queryKeys } from '@/services/queryKeys'
import { getErrorMessage } from '@/utils/apiError'
import axiosInstance from '@/services/api/axiosInstance'
import type { Order, ApiResponse } from '@/types'

/** Paginated order history for the logged-in user. */
export function useOrders(page = 1) {
  return useQuery({
    queryKey: [...queryKeys.orders.all(), page],
    queryFn: () => orderApi.getMyOrders(page),
    staleTime: 1000 * 60 * 2,
  })
}

/** Single order detail — for the order tracking page. */
export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => orderApi.getById(id),
    enabled: Boolean(id),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })
}

/** Cancel an order (only pending/confirmed orders). */
export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await axiosInstance.put<ApiResponse<Order>>(
        `/orders/${id}/cancel`,
        { reason },
      )
      return data.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() })
      toast.success('Order cancelled successfully')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
