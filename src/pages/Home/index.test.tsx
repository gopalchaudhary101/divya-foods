import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/testUtils'
import HomePage from './index'
import { productApi } from '@/services/api/productApi'
import { categoryApi } from '@/services/api/categoryApi'
import type { Product } from '@/types'

vi.mock('@/services/api/productApi', () => ({
  productApi: { getFeatured: vi.fn(), getBestSellers: vi.fn() },
}))
vi.mock('@/services/api/categoryApi', () => ({
  categoryApi: { getAll: vi.fn() },
}))

const featuredProduct: Product = {
  id: 'p1', name: 'Norwegian Salmon', slug: 'norwegian-salmon', description: '', price: 999,
  images: [], category: 'seafood', inStock: true, stockQuantity: 10, rating: 4, reviewCount: 5,
  tags: [], isFeatured: true, isBestSeller: false, createdAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(categoryApi.getAll).mockResolvedValue([])
})

describe('HomePage', () => {
  it('renders the hero heading and tagline', () => {
    vi.mocked(productApi.getFeatured).mockResolvedValue([])
    vi.mocked(productApi.getBestSellers).mockResolvedValue([])
    renderWithProviders(<HomePage />)
    expect(screen.getByRole('heading', { name: 'Divya Foods', level: 1 })).toBeInTheDocument()
  })

  it('renders the featured products section once products load', async () => {
    vi.mocked(productApi.getFeatured).mockResolvedValue([featuredProduct])
    vi.mocked(productApi.getBestSellers).mockResolvedValue([])
    renderWithProviders(<HomePage />)

    expect(await screen.findByText('Featured Products')).toBeInTheDocument()
    expect(await screen.findByText('Norwegian Salmon')).toBeInTheDocument()
  })

  it('hides the featured section entirely when there are no featured products', async () => {
    vi.mocked(productApi.getFeatured).mockResolvedValue([])
    vi.mocked(productApi.getBestSellers).mockResolvedValue([])
    renderWithProviders(<HomePage />)

    await waitFor(() => expect(screen.queryByText('Featured Products')).not.toBeInTheDocument())
  })

  it('renders category grid links to product search', () => {
    vi.mocked(productApi.getFeatured).mockResolvedValue([])
    vi.mocked(productApi.getBestSellers).mockResolvedValue([])
    renderWithProviders(<HomePage />)

    expect(screen.getByText('Salmon').closest('a')).toHaveAttribute('href', '/products?search=salmon')
  })

  it('renders the delivery areas banner', () => {
    vi.mocked(productApi.getFeatured).mockResolvedValue([])
    vi.mocked(productApi.getBestSellers).mockResolvedValue([])
    renderWithProviders(<HomePage />)

    expect(screen.getByText('We Deliver To')).toBeInTheDocument()
    expect(screen.getByText('Gurgaon')).toBeInTheDocument()
  })
})
