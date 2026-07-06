import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import ProductsPage from './index'
import { productApi } from '@/services/api/productApi'
import { categoryApi } from '@/services/api/categoryApi'
import type { Product } from '@/types'

vi.mock('@/services/api/productApi', () => ({
  productApi: { getList: vi.fn(), getBySlug: vi.fn(), getFeatured: vi.fn(), getBestSellers: vi.fn(), search: vi.fn() },
}))
vi.mock('@/services/api/categoryApi', () => ({
  categoryApi: { getAll: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const product: Product = {
  id: 'p1', name: 'Norwegian Salmon', slug: 'norwegian-salmon', description: '', price: 999,
  images: [], category: 'seafood', inStock: true, stockQuantity: 10, rating: 4, reviewCount: 5,
  tags: [], isFeatured: false, isBestSeller: false, createdAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(categoryApi.getAll).mockResolvedValue([
    { id: 'c1', name: 'Seafood', slug: 'seafood', image: '', productCount: 5 },
  ])
})

describe('ProductsPage', () => {
  it('shows a loading skeleton, then renders products', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [product], total: 1, page: 1, totalPages: 1, success: true })
    renderWithProviders(<ProductsPage />)
    expect(await screen.findByText('Norwegian Salmon')).toBeInTheDocument()
    expect(screen.getByText('1 product found')).toBeInTheDocument()
  })

  it('shows an empty state with a clear-filters action', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0, success: true })
    renderWithProviders(<ProductsPage />, { route: '/products?category=seafood' })
    expect(await screen.findByText('No products found')).toBeInTheDocument()
  })

  it('adds a product to the cart and shows a toast', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [product], total: 1, page: 1, totalPages: 1, success: true })
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ProductsPage />)

    await screen.findByText('Norwegian Salmon')
    await user.click(screen.getByRole('button', { name: /Add to Cart/ }))

    expect(store.getState().cart.items[0].productId).toBe('p1')
  })

  it('filters by category from the sidebar', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />)

    await screen.findByText('Seafood')
    await user.click(screen.getByText('Seafood'))

    await waitFor(() => expect(productApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'seafood' })
    ))
  })

  it('filters to in-stock only via the checkbox', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />)

    await user.click(screen.getByLabelText('In stock only'))
    await waitFor(() => expect(productApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ inStock: true })
    ))
  })

  it('changes sort order', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />)

    await user.selectOptions(screen.getByRole('combobox'), 'price_asc')
    await waitFor(() => expect(productApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'price_asc' })
    ))
  })

  it('renders pagination and navigates pages', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [product], total: 30, page: 1, totalPages: 3, success: true })
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />)

    await screen.findByText('Norwegian Salmon')
    await user.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => expect(productApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 })
    ))
  })

  it('clears all active filters', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />, { route: '/products?category=seafood&inStock=true' })

    await screen.findByText('Clear all filters')
    await user.click(screen.getByText('Clear all filters'))

    await waitFor(() => expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument())
  })
})
