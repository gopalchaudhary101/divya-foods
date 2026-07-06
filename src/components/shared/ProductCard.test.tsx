import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import { ProductCard } from './ProductCard'
import type { Product } from '@/types'

const product: Product = {
  id: 'p1',
  name: 'Norwegian Salmon',
  slug: 'norwegian-salmon',
  description: 'Fresh Atlantic salmon',
  price: 899,
  originalPrice: 999,
  images: ['/salmon.webp'],
  category: 'seafood',
  brand: 'Divya',
  inStock: true,
  stockQuantity: 20,
  rating: 4,
  reviewCount: 50,
  tags: [],
  isFeatured: false,
  isBestSeller: true,
  createdAt: '',
}

describe('ProductCard', () => {
  it('renders product name, price, and discount badge', () => {
    renderWithProviders(<ProductCard product={product} />)
    expect(screen.getByText('Norwegian Salmon')).toBeInTheDocument()
    expect(screen.getByText('₹899')).toBeInTheDocument()
    expect(screen.getByText('₹999')).toBeInTheDocument()
    expect(screen.getByText('-10%')).toBeInTheDocument()
    expect(screen.getByText('Best Seller')).toBeInTheDocument()
  })

  it('shows "Out of Stock" and disables the add-to-cart button when unavailable', () => {
    renderWithProviders(<ProductCard product={{ ...product, inStock: false }} />)
    expect(screen.getAllByText('Out of Stock')).not.toHaveLength(0)
    expect(screen.getByRole('button', { name: /Out of Stock/ })).toBeDisabled()
  })

  it('calls onAddToCart with the product when the add-to-cart button is clicked', async () => {
    const user = userEvent.setup()
    const onAddToCart = vi.fn()
    renderWithProviders(<ProductCard product={product} onAddToCart={onAddToCart} />)

    await user.click(screen.getByRole('button', { name: /Add to Cart/ }))
    expect(onAddToCart).toHaveBeenCalledWith(product)
  })

  it('toggles wishlist state when the heart button is clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ProductCard product={product} />)

    await user.click(screen.getByLabelText('Add to wishlist'))
    expect(store.getState().wishlist.productIds).toContain('p1')
  })

  it('links to the product detail page', () => {
    renderWithProviders(<ProductCard product={product} />)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/products/norwegian-salmon')
  })
})
