import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import { useReviews, useCanReview, useSubmitReview, useDeleteReview } from './useReviews'
import { reviewApi } from '@/services/api/reviewApi'
import { createHookWrapper } from '@/test/testUtils'

vi.mock('@/services/api/reviewApi', () => ({
  reviewApi: { getByProduct: vi.fn(), canReview: vi.fn(), create: vi.fn(), delete: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => vi.clearAllMocks())

describe('useReviews', () => {
  it('is disabled without a productId', () => {
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useReviews(''), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches reviews for the given product and page', async () => {
    vi.mocked(reviewApi.getByProduct).mockResolvedValue({ data: [], total: 0, page: 2, limit: 10, totalPages: 1, success: true })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useReviews('p1', 2), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(reviewApi.getByProduct).toHaveBeenCalledWith('p1', 2)
  })
})

describe('useCanReview', () => {
  it('is disabled when the user is not authenticated', () => {
    const { Wrapper } = createHookWrapper({
      auth: { user: null, token: null, isAuthenticated: false, isLoading: false },
    })
    const { result } = renderHook(() => useCanReview('p1'), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(reviewApi.canReview).not.toHaveBeenCalled()
  })

  it('fetches eligibility when authenticated', async () => {
    vi.mocked(reviewApi.canReview).mockResolvedValue({ canReview: true, reason: null })
    const { Wrapper } = createHookWrapper({
      auth: {
        user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', createdAt: '' },
        token: 'tok', isAuthenticated: true, isLoading: false,
      },
    })
    const { result } = renderHook(() => useCanReview('p1'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(reviewApi.canReview).toHaveBeenCalledWith('p1')
  })
})

describe('useSubmitReview', () => {
  it('submits and shows a success toast', async () => {
    vi.mocked(reviewApi.create).mockResolvedValue({ id: 'r1' } as never)
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useSubmitReview(), { wrapper: Wrapper })

    result.current.mutate({ productId: 'p1', rating: 5, comment: 'Great!' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('Review submitted!')
  })

  it('shows an error toast on failure', async () => {
    vi.mocked(reviewApi.create).mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'You have already reviewed this product.' } },
    })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useSubmitReview(), { wrapper: Wrapper })

    result.current.mutate({ productId: 'p1', rating: 5, comment: 'Great!' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('You have already reviewed this product.')
  })
})

describe('useDeleteReview', () => {
  it('deletes and shows a success toast', async () => {
    vi.mocked(reviewApi.delete).mockResolvedValue(undefined)
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useDeleteReview('p1'), { wrapper: Wrapper })

    result.current.mutate('r1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(reviewApi.delete).toHaveBeenCalledWith('r1')
    expect(toast.success).toHaveBeenCalledWith('Review deleted')
  })
})
