import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/testUtils'
import RootLayout from './RootLayout'

vi.mock('./Navbar', () => ({ default: () => <div data-testid="navbar" /> }))
vi.mock('./Footer', () => ({ default: () => <div data-testid="footer" /> }))
vi.mock('@/components/shared/CartDrawer', () => ({ CartDrawer: () => <div data-testid="cart-drawer" /> }))

describe('RootLayout', () => {
  it('renders the Navbar, Footer, CartDrawer, and a skip-to-content link', () => {
    renderWithProviders(<RootLayout />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
    expect(screen.getByTestId('cart-drawer')).toBeInTheDocument()
    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main-content')
  })

  it('applies the dark class to <html> when dark mode is on', () => {
    renderWithProviders(<RootLayout />, {
      preloadedState: { ui: { isDarkMode: true, isMobileMenuOpen: false, isCartOpen: false, isSearchOpen: false } },
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not apply the dark class when dark mode is off', () => {
    renderWithProviders(<RootLayout />, {
      preloadedState: { ui: { isDarkMode: false, isMobileMenuOpen: false, isCartOpen: false, isSearchOpen: false } },
    })
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
