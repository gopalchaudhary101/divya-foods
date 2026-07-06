import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import { CartDrawer } from './CartDrawer'
import type { CartItem } from '@/types'

const item: CartItem = {
  productId: 'p1', name: 'Salmon', price: 500, quantity: 2, image: '/salmon.webp', maxQuantity: 5,
}

function openState(items: CartItem[] = []) {
  const totalItems = items.reduce((s, i) => s + i.quantity, 0)
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0)
  return {
    ui: { isCartOpen: true, isDarkMode: false, isMobileMenuOpen: false, isSearchOpen: false },
    cart: { items, totalItems, totalPrice },
  }
}

describe('CartDrawer', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<CartDrawer />, {
      preloadedState: { ui: { isCartOpen: false, isDarkMode: false, isMobileMenuOpen: false, isSearchOpen: false } },
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an empty-cart message when there are no items', () => {
    renderWithProviders(<CartDrawer />, { preloadedState: openState([]) })
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('lists cart items with quantity and line total', () => {
    renderWithProviders(<CartDrawer />, { preloadedState: openState([item]) })
    expect(screen.getByText('Salmon')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity: 2')).toBeInTheDocument()
    expect(screen.getAllByText('₹1,000').length).toBeGreaterThan(0) // 500 * 2 line total
  })

  it('increments quantity when the + button is clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartDrawer />, { preloadedState: openState([item]) })

    await user.click(screen.getByLabelText('Increase quantity of Salmon'))
    expect(store.getState().cart.items[0].quantity).toBe(3)
  })

  it('decrements quantity, and removes the item once it would drop below 1', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartDrawer />, {
      preloadedState: openState([{ ...item, quantity: 1 }]),
    })

    await user.click(screen.getByLabelText('Decrease quantity of Salmon'))
    expect(store.getState().cart.items).toHaveLength(0)
  })

  it('removes an item via the trash button', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartDrawer />, { preloadedState: openState([item]) })

    await user.click(screen.getByLabelText('Remove Salmon from cart'))
    expect(store.getState().cart.items).toHaveLength(0)
  })

  it('closes the drawer when the close button is clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartDrawer />, { preloadedState: openState([item]) })

    await user.click(screen.getByLabelText('Close cart'))
    expect(store.getState().ui.isCartOpen).toBe(false)
  })

  it('shows FREE delivery once the subtotal meets the threshold', () => {
    const bigItem = { ...item, price: 2500, quantity: 1 }
    renderWithProviders(<CartDrawer />, { preloadedState: openState([bigItem]) })
    expect(screen.getByText('FREE')).toBeInTheDocument()
  })

  it('shows a delivery charge and progress message below the free-delivery threshold', () => {
    renderWithProviders(<CartDrawer />, { preloadedState: openState([item]) }) // subtotal 1000
    expect(screen.getByText(/more for free delivery/)).toBeInTheDocument()
  })
})
