import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import FlashSalesPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)
beforeEach(() => mock.reset())

const saleItem = {
  id: 'p1', name: 'Salmon Deal', slug: 'salmon-deal', price: 999, salePrice: 699,
  saleEndsAt: new Date(Date.now() + 3_600_000).toISOString(), images: ['/salmon.webp'],
  brand: 'Divya', rating: 4, reviewCount: 5, inStock: true, stockQuantity: 10,
}

describe('FlashSalesPage', () => {
  it('shows an empty state when there are no active sales', async () => {
    mock.onGet('/flash-sales').reply(200, { success: true, data: [] })
    renderWithProviders(<FlashSalesPage />)
    expect(await screen.findByText('No flash sales right now')).toBeInTheDocument()
  })

  it('renders a sale item with discount percentage and countdown', async () => {
    mock.onGet('/flash-sales').reply(200, { success: true, data: [saleItem] })
    renderWithProviders(<FlashSalesPage />)

    expect(await screen.findByText('Salmon Deal')).toBeInTheDocument()
    expect(screen.getByText('-30%')).toBeInTheDocument()
    expect(screen.getByText('₹699')).toBeInTheDocument()
  })

  it('adds a sale item to the cart at the sale price', async () => {
    mock.onGet('/flash-sales').reply(200, { success: true, data: [saleItem] })
    const user = userEvent.setup()
    const { store } = renderWithProviders(<FlashSalesPage />)

    await screen.findByText('Salmon Deal')
    await user.click(screen.getByRole('button', { name: 'Add to Cart' }))

    expect(store.getState().cart.items[0]).toMatchObject({ productId: 'p1', price: 699 })
  })

  it('disables the button for an out-of-stock sale item', async () => {
    mock.onGet('/flash-sales').reply(200, { success: true, data: [{ ...saleItem, inStock: false }] })
    renderWithProviders(<FlashSalesPage />)

    expect(await screen.findByRole('button', { name: 'Out of Stock' })).toBeDisabled()
  })
})
