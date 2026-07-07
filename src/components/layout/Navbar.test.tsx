import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import Navbar from './Navbar'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const customerState = {
  auth: {
    user: { id: 'u1', name: 'Priya', email: 'p@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

const adminState = {
  auth: {
    user: { id: 'u2', name: 'Admin', email: 'a@test.com', role: 'admin' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

beforeEach(() => {
  mock.reset()
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: 0 })
})

describe('Navbar', () => {
  it('shows Sign In / Join Free for guests', () => {
    renderWithProviders(<Navbar />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Join Free')).toBeInTheDocument()
  })

  it('shows the account menu for an authenticated customer, without an Admin Panel link', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />, { preloadedState: customerState })

    await user.click(screen.getByLabelText('Account menu'))
    expect(screen.getByRole('menuitem', { name: /My Profile/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /My Orders/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Admin Panel/ })).not.toBeInTheDocument()
  })

  it('shows an Admin Panel link for admin users', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />, { preloadedState: adminState })

    await user.click(screen.getByLabelText('Account menu'))
    expect(screen.getByRole('menuitem', { name: /Admin Panel/ })).toBeInTheDocument()
  })

  it('displays the cart item count badge', () => {
    renderWithProviders(<Navbar />, {
      preloadedState: { cart: { items: [], totalItems: 4, totalPrice: 0 } },
    })
    expect(screen.getByLabelText('Cart (4 items)')).toBeInTheDocument()
  })

  it('opens the cart drawer when the cart button is clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<Navbar />)

    await user.click(screen.getByLabelText(/^Cart \(/))
    expect(store.getState().ui.isCartOpen).toBe(true)
  })

  it('toggles dark mode when the theme button is clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<Navbar />)

    await user.click(screen.getByLabelText('Toggle dark mode'))
    expect(store.getState().ui.isDarkMode).toBe(true)
  })

  it('toggles the mobile menu open and closed', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<Navbar />)

    await user.click(screen.getByLabelText('Toggle navigation menu'))
    expect(store.getState().ui.isMobileMenuOpen).toBe(true)
  })

  it('opens the global search overlay from the search button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />)

    await user.click(screen.getByLabelText('Search products (Ctrl+K)'))
    expect(screen.getByRole('dialog', { name: 'Search products' })).toBeInTheDocument()
  })

  it('shows the wishlist count badge', () => {
    renderWithProviders(<Navbar />, {
      preloadedState: { wishlist: { productIds: ['p1', 'p2'] } },
    })
    expect(screen.getByLabelText('Wishlist (2 items)')).toBeInTheDocument()
  })
})
