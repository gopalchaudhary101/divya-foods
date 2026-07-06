import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { useOrders, useOrder, useCancelOrder } from './useOrders'
import { orderApi } from '@/services/api/orderApi'
import axiosInstance from '@/services/api/axiosInstance'
import { createHookWrapper } from '@/test/testUtils'

vi.mock('@/services/api/orderApi', () => ({
  orderApi: { getMyOrders: vi.fn(), getById: vi.fn() },
}))
vi.mock('@/services/api/axiosInstance', () => ({
  default: { put: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

describe('useOrders', () => {
  it('fetches the given page of order history', async () => {
    vi.mocked(orderApi.getMyOrders).mockResolvedValue({ data: [], total: 0, page: 2, totalPages: 1 })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useOrders(2), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(orderApi.getMyOrders).toHaveBeenCalledWith(2)
  })
})

describe('useOrder', () => {
  it('is disabled when no id is given', () => {
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useOrder(''), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches the order by id', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue({ id: 'o1' } as never)
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useOrder('o1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(orderApi.getById).toHaveBeenCalledWith('o1')
  })
})

describe('useCancelOrder', () => {
  it('PUTs the cancel reason and shows a success toast', async () => {
    vi.mocked(axiosInstance.put).mockResolvedValue({ data: { data: { id: 'o1', status: 'cancelled' } } })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useCancelOrder(), { wrapper: Wrapper })

    result.current.mutate({ id: 'o1', reason: 'Changed my mind' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(axiosInstance.put).toHaveBeenCalledWith('/orders/o1/cancel', { reason: 'Changed my mind' })
    expect(toast.success).toHaveBeenCalledWith('Order cancelled successfully')
  })

  it('shows an error toast on failure', async () => {
    vi.mocked(axiosInstance.put).mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'Cannot cancel a shipped order.' } },
    })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useCancelOrder(), { wrapper: Wrapper })

    result.current.mutate({ id: 'o1', reason: 'x' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('Cannot cancel a shipped order.')
  })
})
