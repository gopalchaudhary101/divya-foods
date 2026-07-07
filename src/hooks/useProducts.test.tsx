import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useProducts, useProduct, useFeaturedProducts, useBestSellers, useProductSearch, useCategories,
} from './useProducts'
import { productApi } from '@/services/api/productApi'
import { categoryApi } from '@/services/api/categoryApi'
import { createHookWrapper } from '@/test/testUtils'

vi.mock('@/services/api/productApi', () => ({
  productApi: { getList: vi.fn(), getBySlug: vi.fn(), getFeatured: vi.fn(), getBestSellers: vi.fn(), search: vi.fn() },
}))
vi.mock('@/services/api/categoryApi', () => ({
  categoryApi: { getAll: vi.fn() },
}))

beforeEach(() => vi.clearAllMocks())

describe('useProducts', () => {
  it('fetches the product list and passes filters through to the API', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useProducts({ category: 'seafood' }), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(productApi.getList).toHaveBeenCalledWith({ category: 'seafood' })
  })
})

describe('useProduct', () => {
  it('is disabled when slug is empty', () => {
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useProduct(''), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(productApi.getBySlug).not.toHaveBeenCalled()
  })

  it('fetches when a slug is provided', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue({ id: 'p1', name: 'Salmon' } as never)
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useProduct('salmon'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(productApi.getBySlug).toHaveBeenCalledWith('salmon')
  })
})

describe('useFeaturedProducts / useBestSellers', () => {
  it('useFeaturedProducts calls productApi.getFeatured', async () => {
    vi.mocked(productApi.getFeatured).mockResolvedValue([])
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useFeaturedProducts(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(productApi.getFeatured).toHaveBeenCalled()
  })

  it('useBestSellers calls productApi.getBestSellers', async () => {
    vi.mocked(productApi.getBestSellers).mockResolvedValue([])
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useBestSellers(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(productApi.getBestSellers).toHaveBeenCalled()
  })
})

describe('useProductSearch', () => {
  it('is disabled for queries shorter than 2 characters', () => {
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useProductSearch('a'), { wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(productApi.search).not.toHaveBeenCalled()
  })

  it('searches once the query reaches 2 characters', async () => {
    vi.mocked(productApi.search).mockResolvedValue([])
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useProductSearch('sa'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(productApi.search).toHaveBeenCalledWith('sa')
  })
})

describe('useCategories', () => {
  it('fetches all categories', async () => {
    vi.mocked(categoryApi.getAll).mockResolvedValue([])
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => useCategories(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(categoryApi.getAll).toHaveBeenCalled()
  })
})
