import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import WishlistPage from './index'
import { wishlistApi } from '@/services/api/wishlistApi'
import type { Product } from '@/types'

vi.mock('@/services/api/wishlistApi', () => ({
  wishlistApi: { getWishlist: vi.fn(), addToWishlist: vi.fn(), removeFromWishlist: vi.fn() },
}))

const authedState = {
  auth: {
    user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

const product: Product = {
  id: 'p1', name: 'Salmon', slug: 'salmon', description: '', price: 999, images: [],
  category: 'seafood', inStock: true, stockQuantity: 10, rating: 4, reviewCount: 5,
  tags: [], isFeatured: false, isBestSeller: false, createdAt: '',
}

beforeEach(() => vi.clearAllMocks())

describe('WishlistPage', () => {
  it('prompts guests to sign in', () => {
    renderWithProviders(<WishlistPage />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Sign in to save products you love and access your wishlist on any device.')).toBeInTheDocument()
  })

  it('shows the local item count to guests who have wishlisted items before signing in', () => {
    renderWithProviders(<WishlistPage />, { preloadedState: { wishlist: { productIds: ['p1', 'p2'] } } })
    expect(screen.getByText(/You have/)).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  })

  it('shows an empty state for an authenticated user with no wishlist items', async () => {
    vi.mocked(wishlistApi.getWishlist).mockResolvedValue([])
    renderWithProviders(<WishlistPage />, { preloadedState: authedState })
    expect(await screen.findByText('Your wishlist is empty')).toBeInTheDocument()
  })

  it('renders wishlisted products, including the item count and a working title (no crash)', async () => {
    vi.mocked(wishlistApi.getWishlist).mockResolvedValue([product])
    renderWithProviders(<WishlistPage />, { preloadedState: authedState })

    expect(await screen.findByText('Salmon')).toBeInTheDocument()
    expect(screen.getByText('(1 items)')).toBeInTheDocument()
  })

  it('adds a wishlisted product to the cart', async () => {
    vi.mocked(wishlistApi.getWishlist).mockResolvedValue([product])
    const user = userEvent.setup()
    const { store } = renderWithProviders(<WishlistPage />, { preloadedState: authedState })

    await screen.findByText('Salmon')
    await user.click(screen.getByRole('button', { name: /Add to Cart/ }))

    expect(store.getState().cart.items[0].productId).toBe('p1')
  })
})
