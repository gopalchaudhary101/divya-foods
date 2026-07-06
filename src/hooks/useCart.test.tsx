import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { useCartQuery, useSyncCart, useAddToCart, useUpdateCartItem, useRemoveFromCart } from './useCart'
import { cartApi } from '@/services/api/cartApi'
import { createHookWrapper } from '@/test/testUtils'

vi.mock('@/services/api/cartApi', () => ({
  cartApi: { getCart: vi.fn(), syncCart: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), removeItem: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

const authedState = {
  auth: {
    user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

const item = { productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: null, maxQuantity: 5 }

describe('useCartQuery', () => {
  it('is disabled when the user is unauthenticated', () => {
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useCartQuery(), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(cartApi.getCart).not.toHaveBeenCalled()
  })

  it('fetches the server cart when authenticated', async () => {
    vi.mocked(cartApi.getCart).mockResolvedValue({ items: [], totalItems: 0, totalPrice: 0 })
    const { Wrapper } = createHookWrapper(authedState)
    const { result } = renderHook(() => useCartQuery(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cartApi.getCart).toHaveBeenCalled()
  })
})

describe('useSyncCart', () => {
  it('calls syncCart with the given items', async () => {
    vi.mocked(cartApi.syncCart).mockResolvedValue(undefined)
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useSyncCart(), { wrapper: Wrapper })
    result.current.mutate([item])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cartApi.syncCart).toHaveBeenCalledWith([item])
  })
})

describe('useAddToCart', () => {
  it('adds an item and shows no error on success', async () => {
    vi.mocked(cartApi.addItem).mockResolvedValue({ items: [item], totalItems: 1, totalPrice: 999 })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useAddToCart(), { wrapper: Wrapper })
    result.current.mutate(item)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('shows an error toast when adding fails', async () => {
    vi.mocked(cartApi.addItem).mockRejectedValue({
      isAxiosError: true, response: { data: { detail: 'Out of stock.' } },
    })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useAddToCart(), { wrapper: Wrapper })
    result.current.mutate(item)
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('Out of stock.')
  })
})

describe('useUpdateCartItem', () => {
  it('updates quantity for the given product', async () => {
    vi.mocked(cartApi.updateItem).mockResolvedValue({ items: [], totalItems: 3, totalPrice: 2997 })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useUpdateCartItem(), { wrapper: Wrapper })
    result.current.mutate({ productId: 'p1', quantity: 3 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cartApi.updateItem).toHaveBeenCalledWith('p1', 3)
  })
})

describe('useRemoveFromCart', () => {
  it('removes the given product', async () => {
    vi.mocked(cartApi.removeItem).mockResolvedValue({ items: [], totalItems: 0, totalPrice: 0 })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useRemoveFromCart(), { wrapper: Wrapper })
    result.current.mutate('p1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(cartApi.removeItem).toHaveBeenCalledWith('p1')
  })
})
