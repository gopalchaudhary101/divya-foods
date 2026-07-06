import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWishlistQuery, useToggleWishlist, useIsWishlisted } from './useWishlist'
import { wishlistApi } from '@/services/api/wishlistApi'
import { createHookWrapper } from '@/test/testUtils'

vi.mock('@/services/api/wishlistApi', () => ({
  wishlistApi: { getWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

const authedState = {
  auth: {
    user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

describe('useWishlistQuery', () => {
  it('does not call the API when unauthenticated', () => {
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useWishlistQuery(), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(wishlistApi.getWishlist).not.toHaveBeenCalled()
  })

  it('fetches the server wishlist when authenticated', async () => {
    vi.mocked(wishlistApi.getWishlist).mockResolvedValue([])
    const { Wrapper } = createHookWrapper(authedState)
    const { result } = renderHook(() => useWishlistQuery(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(wishlistApi.getWishlist).toHaveBeenCalled()
  })
})

describe('useToggleWishlist', () => {
  it('updates the Redux store immediately for a guest, without calling the API', () => {
    const { Wrapper, store } = createHookWrapper()
    const { result } = renderHook(() => useToggleWishlist(), { wrapper: Wrapper })

    act(() => result.current('p1'))

    expect(store.getState().wishlist.productIds).toEqual(['p1'])
    expect(wishlistApi.addToWishlist).not.toHaveBeenCalled()
  })

  it('syncs to the server for an authenticated user', async () => {
    vi.mocked(wishlistApi.addToWishlist).mockResolvedValue(undefined)
    const { Wrapper, store } = createHookWrapper(authedState)
    const { result } = renderHook(() => useToggleWishlist(), { wrapper: Wrapper })

    act(() => result.current('p1'))

    expect(store.getState().wishlist.productIds).toEqual(['p1'])
    await waitFor(() => expect(wishlistApi.addToWishlist).toHaveBeenCalledWith('p1'))
    expect(wishlistApi.removeFromWishlist).not.toHaveBeenCalled()
  })

  it('calls removeFromWishlist when the product is already wishlisted', async () => {
    vi.mocked(wishlistApi.removeFromWishlist).mockResolvedValue(undefined)
    const { Wrapper } = createHookWrapper({
      ...authedState,
      wishlist: { productIds: ['p1'] },
    })
    const { result } = renderHook(() => useToggleWishlist(), { wrapper: Wrapper })

    act(() => result.current('p1'))

    await waitFor(() => expect(wishlistApi.removeFromWishlist).toHaveBeenCalledWith('p1'))
    expect(wishlistApi.addToWishlist).not.toHaveBeenCalled()
  })

  // Regression test: the dispatch(toggleWishlist(...)) call used to happen before
  // deciding add-vs-remove, and since the mutation runs asynchronously, React Query
  // rebound mutationFn to the post-dispatch (already-toggled) Redux state before it
  // actually ran — so every toggle called the OPPOSITE of the intended API endpoint.
  // See useWishlist.ts useToggleWishlist for the fix (decide action before dispatch).
  it('calls the correct endpoint even though dispatch fires before the mutation runs', async () => {
    vi.mocked(wishlistApi.addToWishlist).mockResolvedValue(undefined)
    const { Wrapper, store } = createHookWrapper(authedState)
    const { result } = renderHook(() => useToggleWishlist(), { wrapper: Wrapper })

    act(() => result.current('new-product'))

    // By the time this runs, Redux already reflects the post-toggle state...
    expect(store.getState().wishlist.productIds).toEqual(['new-product'])
    // ...but the mutation must still have decided "add" from the PRE-toggle state.
    await waitFor(() => expect(wishlistApi.addToWishlist).toHaveBeenCalledWith('new-product'))
    expect(wishlistApi.removeFromWishlist).not.toHaveBeenCalled()
  })
})

describe('useIsWishlisted', () => {
  it('reflects the local Redux wishlist state', () => {
    const { Wrapper } = createHookWrapper({ wishlist: { productIds: ['p1'] } })
    const { result: inList } = renderHook(() => useIsWishlisted('p1'), { wrapper: Wrapper })
    const { result: notInList } = renderHook(() => useIsWishlisted('p2'), { wrapper: Wrapper })
    expect(inList.current).toBe(true)
    expect(notInList.current).toBe(false)
  })
})
