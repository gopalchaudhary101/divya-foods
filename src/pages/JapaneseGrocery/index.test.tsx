import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import JapaneseGroceryPage from './index'
import { productApi } from '@/services/api/productApi'
import type { Product } from '@/types'

vi.mock('@/services/api/productApi', () => ({
  productApi: { getList: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const product: Product = {
  id: 'p1', name: 'Miso Paste', slug: 'miso-paste', description: '', price: 499,
  images: [], category: 'japanese-grocery', inStock: true, stockQuantity: 10, rating: 4, reviewCount: 5,
  tags: [], isFeatured: false, isBestSeller: false, createdAt: '',
}

beforeEach(() => vi.clearAllMocks())

describe('JapaneseGroceryPage', () => {
  it('requests products scoped to the japanese-grocery category', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    renderWithProviders(<JapaneseGroceryPage />)
    expect(productApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'japanese-grocery' })
    )
  })

  it('renders products once loaded', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [product], total: 1, page: 1, limit: 20, totalPages: 1, success: true })
    renderWithProviders(<JapaneseGroceryPage />)
    expect(await screen.findByText('Miso Paste')).toBeInTheDocument()
  })

  it('shows a "coming soon" message when there are no products', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    renderWithProviders(<JapaneseGroceryPage />)
    expect(await screen.findByText('Japanese grocery products coming soon.')).toBeInTheDocument()
  })

  it('adds a product to the cart', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [product], total: 1, page: 1, limit: 20, totalPages: 1, success: true })
    const user = userEvent.setup()
    const { store } = renderWithProviders(<JapaneseGroceryPage />)

    await screen.findByText('Miso Paste')
    await user.click(screen.getByRole('button', { name: /Add to Cart/ }))

    expect(store.getState().cart.items[0].productId).toBe('p1')
  })

  it('expands a FAQ item on click', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<JapaneseGroceryPage />)

    const question = 'How long do Japanese condiments keep once opened?'
    await user.click(screen.getByText(question))

    expect(screen.getByText(/Miso and mirin keep for 3–6 months/)).toBeInTheDocument()
  })

  it('includes FAQPage JSON-LD schema matching the visible FAQ content', async () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    renderWithProviders(<JapaneseGroceryPage />)
    await screen.findByText('How long do Japanese condiments keep once opened?')

    const faqLd = await waitFor(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      const ld = scripts.map(s => JSON.parse(s.textContent ?? '{}')).find(l => l['@type'] === 'FAQPage')
      expect(ld).toBeDefined()
      return ld
    })

    expect(faqLd.mainEntity).toHaveLength(4)
    expect(faqLd.mainEntity[0].name).toBe('How long do Japanese condiments keep once opened?')
    expect(faqLd.mainEntity[0].acceptedAnswer.text).toContain('Miso and mirin keep for 3–6 months')
  })

  it('renders the ingredient guide', () => {
    vi.mocked(productApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    renderWithProviders(<JapaneseGroceryPage />)
    expect(screen.getByText('Miso')).toBeInTheDocument()
    expect(screen.getByText('Mirin')).toBeInTheDocument()
  })
})
