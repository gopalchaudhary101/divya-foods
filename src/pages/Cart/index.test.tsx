import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import CartPage from './index'
import { whatsappApi } from '@/services/api/whatsappApi'
import type { CartItem } from '@/types'

vi.mock('@/services/api/whatsappApi', () => ({
  whatsappApi: { getConfig: vi.fn(), trackShare: vi.fn() },
}))

const item: CartItem = {
  productId: 'p1', name: 'Salmon', price: 500, quantity: 2, image: '/salmon.webp', maxQuantity: 5,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(whatsappApi.getConfig).mockResolvedValue({
    enabled: false, phoneNumber: '', productMessageTemplate: '', cartMessageTemplate: '', orderMessageTemplate: '',
  })
  vi.mocked(whatsappApi.trackShare).mockResolvedValue(undefined)
  vi.stubGlobal('open', vi.fn())
})

function cartState(items: CartItem[]) {
  const totalItems = items.reduce((s, i) => s + i.quantity, 0)
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0)
  return { cart: { items, totalItems, totalPrice } }
}

describe('CartPage', () => {
  it('shows the empty-cart state with a link to browse products', () => {
    renderWithProviders(<CartPage />, { preloadedState: cartState([]) })
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('lists items and computes subtotal/delivery/total', () => {
    renderWithProviders(<CartPage />, { preloadedState: cartState([item]) })
    expect(screen.getByText('Salmon')).toBeInTheDocument()
    expect(screen.getByText('Shopping Cart')).toBeInTheDocument()
    // subtotal 1000, below 2000 free-delivery threshold → ₹100 delivery, ₹1100 total
    expect(screen.getByText('₹100')).toBeInTheDocument()
    expect(screen.getByText('₹1,100')).toBeInTheDocument()
  })

  it('shows FREE delivery messaging once above the threshold', () => {
    renderWithProviders(<CartPage />, {
      preloadedState: cartState([{ ...item, price: 2500, quantity: 1 }]),
    })
    expect(screen.getByText('You qualify for FREE delivery!')).toBeInTheDocument()
  })

  it('increments and decrements item quantity', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartPage />, { preloadedState: cartState([item]) })

    await user.click(screen.getByLabelText('Increase quantity'))
    expect(store.getState().cart.items[0].quantity).toBe(3)

    await user.click(screen.getByLabelText('Decrease quantity'))
    expect(store.getState().cart.items[0].quantity).toBe(2)
  })

  it('removes the item once quantity is decremented below 1', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartPage />, {
      preloadedState: cartState([{ ...item, quantity: 1 }]),
    })
    await user.click(screen.getByLabelText('Decrease quantity'))
    expect(store.getState().cart.items).toHaveLength(0)
  })

  it('removes an item via the trash button', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartPage />, { preloadedState: cartState([item]) })
    await user.click(screen.getByLabelText('Remove item'))
    expect(store.getState().cart.items).toHaveLength(0)
  })

  it('clears the entire cart', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<CartPage />, { preloadedState: cartState([item]) })
    await user.click(screen.getByText('Clear cart'))
    expect(store.getState().cart.items).toHaveLength(0)
  })

  it('requires a coupon code before navigating to checkout', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CartPage />, { preloadedState: cartState([item]) })
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByText('Please enter a coupon code')).toBeInTheDocument()
  })

  it('uppercases the coupon input as the user types', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CartPage />, { preloadedState: cartState([item]) })
    const input = screen.getByPlaceholderText('DIVYA10') as HTMLInputElement
    await user.type(input, 'save10')
    expect(input.value).toBe('SAVE10')
  })

  it('shows an "Enquire on WhatsApp" button that tracks every cart item when enabled', async () => {
    vi.mocked(whatsappApi.getConfig).mockResolvedValue({
      enabled: true, phoneNumber: '919999123242',
      productMessageTemplate: '', cartMessageTemplate: 'Items:\n{itemsList}\nTotal: {total}', orderMessageTemplate: '',
    })
    const user = userEvent.setup()
    renderWithProviders(<CartPage />, {
      preloadedState: cartState([item, { ...item, productId: 'p2', name: 'Tuna' }]),
    })

    const button = await screen.findByRole('button', { name: 'Enquire on WhatsApp' })
    await user.click(button)

    expect(whatsappApi.trackShare).toHaveBeenCalledWith({ productId: 'p1', productName: 'Salmon', source: 'cart' })
    expect(whatsappApi.trackShare).toHaveBeenCalledWith({ productId: 'p2', productName: 'Tuna', source: 'cart' })
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/919999123242?text='),
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('does not show a WhatsApp button when sharing is disabled', () => {
    renderWithProviders(<CartPage />, { preloadedState: cartState([item]) })
    expect(screen.queryByRole('button', { name: 'Enquire on WhatsApp' })).not.toBeInTheDocument()
  })
})
