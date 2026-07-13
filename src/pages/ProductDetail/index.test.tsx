import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import userEvent from '@testing-library/user-event'
import ProductDetailPage from './index'
import { productApi } from '@/services/api/productApi'
import { reviewApi } from '@/services/api/reviewApi'
import { createTestStore, createTestQueryClient, type PartialRootState } from '@/test/testUtils'

vi.mock('@/services/api/productApi', () => ({
  productApi: { getBySlug: vi.fn(), getRelated: vi.fn() },
}))
vi.mock('@/services/api/reviewApi', () => ({
  reviewApi: { getByProduct: vi.fn(), canReview: vi.fn(), create: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/services/api/wishlistApi', () => ({
  wishlistApi: { getWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

function renderAtSlug(slug: string, preloadedState?: PartialRootState) {
  const store = createTestStore(preloadedState)
  const queryClient = createTestQueryClient()
  return render(
    <HelmetProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/products/${slug}`]}>
            <Routes>
              <Route path="/products/:slug" element={<ProductDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    </HelmetProvider>
  )
}

const product = {
  id: 'p1', name: 'Norwegian Salmon', slug: 'norwegian-salmon', description: 'Fresh salmon',
  price: 899, originalPrice: 999, images: ['/salmon.webp'], category: 'seafood', brand: 'Divya',
  inStock: true, stockQuantity: 10, rating: 4.5, reviewCount: 2, tags: ['fresh'],
  isFeatured: false, isBestSeller: true, createdAt: '', weight: '500g', origin: 'Norway',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(reviewApi.getByProduct).mockResolvedValue({ data: [], total: 0, page: 1, limit: 10, totalPages: 0, success: true })
  vi.mocked(reviewApi.canReview).mockResolvedValue({ canReview: false, reason: 'no_purchase' })
  vi.mocked(productApi.getRelated).mockResolvedValue([])
})

describe('ProductDetailPage', () => {
  it('shows "Product Not Found" when the slug does not resolve', async () => {
    vi.mocked(productApi.getBySlug).mockRejectedValue(new Error('404'))
    renderAtSlug('does-not-exist')
    expect(await screen.findByText('Product Not Found')).toBeInTheDocument()
  })

  it('renders product details, price, and discount', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    renderAtSlug('norwegian-salmon')

    expect(await screen.findByRole('heading', { name: 'Norwegian Salmon' })).toBeInTheDocument()
    expect(screen.getByText('₹899')).toBeInTheDocument()
    expect(screen.getByText('₹999')).toBeInTheDocument()
    expect(screen.getByText('Save 10%')).toBeInTheDocument()
    expect(document.title).toBe('Norwegian Salmon — Divya Foods')
  })

  it('includes Product and BreadcrumbList JSON-LD schema', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    renderAtSlug('norwegian-salmon')
    await screen.findByRole('heading', { name: 'Norwegian Salmon' })

    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    const parsed = scripts.map(s => JSON.parse(s.textContent ?? '{}'))

    expect(parsed.some(ld => ld['@type'] === 'Product' && ld.name === 'Norwegian Salmon')).toBe(true)

    const breadcrumb = parsed.find(ld => ld['@type'] === 'BreadcrumbList')
    expect(breadcrumb).toBeDefined()
    expect(breadcrumb.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Home', 'Products', 'Norwegian Salmon'])
  })

  it('adds the product to the cart at the default quantity', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    const user = userEvent.setup()
    const store = createTestStore()
    const queryClient = createTestQueryClient()
    render(
      <HelmetProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/products/norwegian-salmon']}>
              <Routes><Route path="/products/:slug" element={<ProductDetailPage />} /></Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </Provider>
      </HelmetProvider>
    )

    await screen.findByRole('heading', { name: 'Norwegian Salmon' })
    await user.click(screen.getByRole('button', { name: /Add to Cart/ }))

    expect(store.getState().cart.items[0]).toMatchObject({ productId: 'p1', quantity: 1 })
  })

  it('increments quantity before adding to cart', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    const user = userEvent.setup()
    renderAtSlug('norwegian-salmon')

    await screen.findByRole('heading', { name: 'Norwegian Salmon' })
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(b => b.querySelector('svg.lucide-plus'))!
    await user.click(plusButton)

    // quantity display shows 2
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('toggles wishlist state', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    const user = userEvent.setup()
    const store = createTestStore()
    const queryClient = createTestQueryClient()
    render(
      <HelmetProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/products/norwegian-salmon']}>
              <Routes><Route path="/products/:slug" element={<ProductDetailPage />} /></Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </Provider>
      </HelmetProvider>
    )

    await screen.findByRole('heading', { name: 'Norwegian Salmon' })
    await user.click(screen.getByLabelText('Add to wishlist'))
    expect(store.getState().wishlist.productIds).toContain('p1')
  })

  it('switches to the reviews tab and shows the eligibility-gated write button', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    vi.mocked(reviewApi.canReview).mockResolvedValue({ canReview: true, reason: null })
    const user = userEvent.setup()
    renderAtSlug('norwegian-salmon', {
      auth: {
        user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', createdAt: '' },
        token: 'tok', isAuthenticated: true, isLoading: false,
      },
    })

    await screen.findByRole('heading', { name: 'Norwegian Salmon' })
    await user.click(screen.getByText('Reviews (2)'))

    expect(await screen.findByText('Write a Review')).toBeInTheDocument()
  })

  it('shows out-of-stock state without a quantity stepper', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue({ ...product, inStock: false } as never)
    renderAtSlug('norwegian-salmon')

    await screen.findByRole('heading', { name: 'Norwegian Salmon' })
    expect(screen.getByRole('button', { name: 'Out of Stock' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Increase quantity' })).not.toBeInTheDocument()
  })

  it('does not show a related-products section when there are none', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    renderAtSlug('norwegian-salmon')

    await screen.findByRole('heading', { name: 'Norwegian Salmon' })
    expect(screen.queryByText('You May Also Like')).not.toBeInTheDocument()
  })

  it('shows related products and can add one to the cart', async () => {
    vi.mocked(productApi.getBySlug).mockResolvedValue(product as never)
    vi.mocked(productApi.getRelated).mockResolvedValue([
      { ...product, id: 'p2', name: 'King Prawns', slug: 'king-prawns' },
    ] as never)
    const user = userEvent.setup()
    const store = createTestStore()
    const queryClient = createTestQueryClient()
    render(
      <HelmetProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/products/norwegian-salmon']}>
              <Routes><Route path="/products/:slug" element={<ProductDetailPage />} /></Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </Provider>
      </HelmetProvider>
    )

    await screen.findByRole('heading', { name: 'Norwegian Salmon' })
    expect(await screen.findByText('You May Also Like')).toBeInTheDocument()
    expect(screen.getByText('King Prawns')).toBeInTheDocument()

    const addToCartButtons = screen.getAllByRole('button', { name: /Add to Cart/ })
    await user.click(addToCartButtons[1]) // [0] is the main product's own button
    expect(store.getState().cart.items.some(i => i.productId === 'p2')).toBe(true)
  })
})
