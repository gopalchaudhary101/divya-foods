import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminOrdersPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const order = {
  id: 'o1', orderNumber: 'DF-001', status: 'pending', paymentStatus: 'paid', paymentMethod: 'razorpay',
  deliveryAddress: { fullName: 'Priya Sharma', phone: '9999999999', addressLine1: 'Street 1', city: 'Delhi', state: 'Delhi', pincode: '110001' },
  items: [{ productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: '' }],
  subtotal: 999, deliveryCharge: 0, discount: 0, total: 999,
  trackingTimeline: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  mock.reset()
  mock.onGet(/\/admin\/orders/).reply(200, { success: true, data: { data: [order], total: 1, page: 1, totalPages: 1 } })
})

describe('AdminOrdersPage', () => {
  it('lists orders', async () => {
    renderWithProviders(<AdminOrdersPage />)
    expect(await screen.findByText('DF-001')).toBeInTheDocument()
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument()
  })

  it('selects a row and shows the bulk action bar', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminOrdersPage />)

    await screen.findByText('DF-001')
    const checkboxes = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-square, svg.lucide-square-check-big'))
    await user.click(checkboxes[1]) // [0] is "select all"

    expect(await screen.findByText('1 selected')).toBeInTheDocument()
  })

  it('applies a bulk status update to selected orders', async () => {
    mock.onPut('/admin/bulk-order-status').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminOrdersPage />)

    await screen.findByText('DF-001')
    const checkboxes = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-square, svg.lucide-square-check-big'))
    await user.click(checkboxes[1])

    await screen.findByText('1 selected')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(mock.history.put[0].data).toBe(
      JSON.stringify({ order_ids: ['o1'], status: 'confirmed' })
    ))
  })

  it('opens the CSV export URL in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderWithProviders(<AdminOrdersPage />)

    await screen.findByText('DF-001')
    await user.click(screen.getByRole('button', { name: /Export CSV/ }))

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('/admin/export-orders'), '_blank')
  })

  it('filters by search term', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminOrdersPage />)

    await screen.findByText('DF-001')
    await user.type(screen.getByPlaceholderText('Search order # or customer…'), 'DF-001')

    await waitFor(() => {
      const lastCall = mock.history.get[mock.history.get.length - 1]
      expect(lastCall.url).toContain('search=DF-001')
    })
  })

  it('shows an empty state with no orders', async () => {
    mock.onGet(/\/admin\/orders/).reply(200, { success: true, data: { data: [], total: 0, page: 1, totalPages: 0 } })
    renderWithProviders(<AdminOrdersPage />)
    expect(await screen.findByText('No orders found')).toBeInTheDocument()
  })
})
