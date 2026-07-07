import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminDashboardPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const adminState = {
  auth: {
    user: { id: 'u1', name: 'Admin', email: 'admin@test.com', role: 'admin' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

const order = {
  id: 'o1', orderNumber: 'DF-001', status: 'pending', paymentStatus: 'paid', paymentMethod: 'razorpay',
  deliveryAddress: { fullName: 'Priya Sharma', phone: '9999999999', addressLine1: 'Street 1', city: 'Delhi', state: 'Delhi', pincode: '110001' },
  items: [{ productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: '' }],
  subtotal: 999, deliveryCharge: 0, discount: 0, total: 999,
  trackingTimeline: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

const stats = {
  totalOrders: 10, pendingOrders: 2, totalProducts: 50, totalCustomers: 30, totalRevenue: 50000,
  recentOrders: [], lowStockProducts: [],
}

beforeEach(() => {
  mock.reset()
  mock.onGet('/admin/stats').reply(200, { success: true, data: stats })
  mock.onGet(/\/admin\/orders/).reply(200, { success: true, data: { data: [order], total: 1, page: 1, totalPages: 1 } })
  mock.onGet('/admin/settings').reply(200, {
    success: true,
    data: { businessName: 'Divya Luxury Seafoods', gstNumber: '', fssaiNumber: '', deliveryProviders: ['Porter', 'Dunzo'] },
  })
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('AdminDashboardPage', () => {
  it('renders stat cards', async () => {
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })
    expect(await screen.findByText('10')).toBeInTheDocument()
    expect(screen.getByText('₹50,000')).toBeInTheDocument()
    expect(screen.getByText('2 pending')).toBeInTheDocument()
  })

  it('lists orders in the table', async () => {
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })
    expect(await screen.findByText('DF-001')).toBeInTheDocument()
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument()
  })

  it('shows a low-stock banner when there are low-stock products', async () => {
    mock.onGet('/admin/stats').reply(200, {
      success: true,
      data: { ...stats, lowStockProducts: [{ id: 'p1', name: 'Salmon', slug: 'salmon', stockQuantity: 2, inStock: true, image: null }] },
    })
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })
    expect(await screen.findByText(/Low Stock/)).toBeInTheDocument()
  })

  it('filters orders by search term', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })

    await screen.findByText('DF-001')
    await user.type(screen.getByPlaceholderText('Order # or name...'), 'DF-001')

    await waitFor(() => {
      const lastCall = mock.history.get[mock.history.get.length - 1]
      expect(lastCall.url).toContain('search=DF-001')
    })
  })

  it('opens the order detail modal and updates status', async () => {
    mock.onPut('/admin/orders/o1/status').reply(200, { success: true, data: { ...order, status: 'confirmed' } })
    const user = userEvent.setup()
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })

    await screen.findByText('DF-001')
    await user.click(screen.getByRole('button', { name: /View/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByText('→ confirmed'))
    await user.click(screen.getByRole('button', { name: 'Move to confirmed' }))

    await waitFor(() => expect(mock.history.put[0].url).toBe('/admin/orders/o1/status'))
  })

  it('shows an empty state when there are no orders', async () => {
    mock.onGet(/\/admin\/orders/).reply(200, { success: true, data: { data: [], total: 0, page: 1, totalPages: 0 } })
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })
    expect(await screen.findByText('No orders found')).toBeInTheDocument()
  })

  it('assigns a delivery partner from the Delivery tab', async () => {
    mock.onPut('/admin/orders/o1/delivery').reply(200, {
      success: true,
      data: { ...order, delivery: { provider: 'Porter', trackingId: 'PTR-1', deliveryStatus: 'packed', createdAt: '', updatedAt: '' } },
    })
    const user = userEvent.setup()
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })

    await screen.findByText('DF-001')
    await user.click(screen.getByRole('button', { name: /View/ }))
    await user.click(screen.getByRole('button', { name: /Delivery/ }))

    const dialog = screen.getByRole('dialog')
    const providerSelect = await within(dialog).findByDisplayValue('Select…')
    await user.selectOptions(providerSelect, 'Porter')

    const [trackingInput] = within(dialog).getAllByRole('textbox')
    await user.type(trackingInput, 'PTR-1')

    await user.click(screen.getByRole('button', { name: 'Create Delivery' }))

    await waitFor(() => expect(mock.history.put.some(c => c.url === '/admin/orders/o1/delivery')).toBe(true))
    const body = JSON.parse(mock.history.put.find(c => c.url === '/admin/orders/o1/delivery')!.data)
    expect(body.provider).toBe('Porter')
    expect(body.trackingId).toBe('PTR-1')
  })

  it('updates delivery status and notes it in the timeline', async () => {
    mock.onPut('/admin/orders/o1/delivery').reply(200, {
      success: true,
      data: {
        ...order,
        delivery: { provider: 'Porter', deliveryStatus: 'in_transit', createdAt: '', updatedAt: '' },
        trackingTimeline: [{ status: 'delivery_in_transit', timestamp: '2026-01-02T00:00:00Z', note: 'is out for delivery.' }],
      },
    })
    const user = userEvent.setup()
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })

    await screen.findByText('DF-001')
    await user.click(screen.getByRole('button', { name: /View/ }))
    await user.click(screen.getByRole('button', { name: /Delivery/ }))

    const dialog = screen.getByRole('dialog')
    await within(dialog).findByText('Select…')
    await user.click(within(dialog).getByRole('button', { name: 'In Transit' }))
    await user.click(within(dialog).getByRole('button', { name: /Set status/ }))

    await waitFor(() => expect(mock.history.put.some(c => c.url === '/admin/orders/o1/delivery')).toBe(true))
    const body = JSON.parse(mock.history.put.find(c => c.url === '/admin/orders/o1/delivery')!.data)
    expect(body.deliveryStatus).toBe('in_transit')
  })

  it('downloads the invoice from the order detail modal', async () => {
    mock.onGet('/admin/orders/o1/invoice').reply(200, new Blob(['%PDF-1.4']), { 'content-type': 'application/pdf' })
    const user = userEvent.setup()
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })

    await screen.findByText('DF-001')
    await user.click(screen.getByRole('button', { name: /View/ }))
    await user.click(screen.getByTitle('Download Invoice'))

    await waitFor(() => expect(mock.history.get.some(c => c.url === '/admin/orders/o1/invoice')).toBe(true))
  })

  it('emails the invoice from the order detail modal', async () => {
    mock.onPost('/admin/orders/o1/invoice/email').reply(200, { success: true, message: 'Invoice emailed to cust@test.com' })
    const user = userEvent.setup()
    renderWithProviders(<AdminDashboardPage />, { preloadedState: adminState })

    await screen.findByText('DF-001')
    await user.click(screen.getByRole('button', { name: /View/ }))
    await user.click(screen.getByTitle('Email Invoice'))

    await waitFor(() => expect(mock.history.post.some(c => c.url === '/admin/orders/o1/invoice/email')).toBe(true))
  })
})
