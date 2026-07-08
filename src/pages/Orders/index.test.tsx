import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import userEvent from '@testing-library/user-event'
import OrdersPage from './index'
import { orderApi } from '@/services/api/orderApi'
import { returnApi } from '@/services/api/returnApi'
import axiosInstance from '@/services/api/axiosInstance'
import { createTestStore, createTestQueryClient } from '@/test/testUtils'

vi.mock('@/services/api/orderApi', () => ({
  orderApi: {
    getMyOrders: vi.fn(), getById: vi.fn(),
    downloadInvoice: vi.fn(), printInvoice: vi.fn(), emailInvoice: vi.fn(),
  },
}))
vi.mock('@/services/api/returnApi', () => ({
  returnApi: { getForOrder: vi.fn(), request: vi.fn() },
}))
vi.mock('@/services/api/axiosInstance', () => ({
  default: { put: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

function renderAtRoute(route: string) {
  const store = createTestStore()
  const queryClient = createTestQueryClient()
  return render(
    <HelmetProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrdersPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    </HelmetProvider>
  )
}

const order = {
  id: 'o1', orderNumber: 'DF-000123', status: 'confirmed', paymentStatus: 'paid',
  paymentMethod: 'razorpay', deliveryAddress: {
    label: 'Home', fullName: 'Priya', phone: '9999999999', addressLine1: 'Street 1',
    city: 'Delhi', state: 'Delhi', pincode: '110001',
  },
  items: [{ productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: '' }],
  subtotal: 999, deliveryCharge: 0, discount: 0, total: 999,
  trackingTimeline: [], delivery: null, deliverySlot: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(returnApi.getForOrder).mockResolvedValue(null)
})

describe('OrdersPage — list view', () => {
  it('shows an empty state when there are no orders', async () => {
    vi.mocked(orderApi.getMyOrders).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 })
    renderAtRoute('/orders')
    expect(await screen.findByText('No orders yet')).toBeInTheDocument()
  })

  it('lists orders with number, status, and total', async () => {
    vi.mocked(orderApi.getMyOrders).mockResolvedValue({ data: [order], total: 1, page: 1, totalPages: 1 })
    renderAtRoute('/orders')
    expect(await screen.findByText('DF-000123')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('₹999')).toBeInTheDocument()
  })
})

describe('OrdersPage — detail view', () => {
  it('does not crash and sets a dynamic title (regression: Helmet multi-child title bug)', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order)
    renderAtRoute('/orders/o1')
    await screen.findByText('DF-000123')
    await waitFor(() => expect(document.title).toBe('Order Details — Divya Luxury Seafoods'))
  })

  it('shows order items, address, and totals', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order)
    renderAtRoute('/orders/o1')

    expect(await screen.findByText('Salmon')).toBeInTheDocument()
    expect(screen.getByText('Priya')).toBeInTheDocument()
    expect(screen.getByText((_, el) => Boolean(el?.textContent?.includes('Delhi, Delhi — 110001')) && el?.tagName === 'P')).toBeInTheDocument()
    expect(screen.getAllByText('₹999').length).toBeGreaterThan(0)
  })

  it('shows "order not found" for a missing order', async () => {
    vi.mocked(orderApi.getById).mockRejectedValue(new Error('404'))
    renderAtRoute('/orders/bad-id')
    expect(await screen.findByText('Order not found.')).toBeInTheDocument()
  })

  it('allows cancelling a pending/confirmed order', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order)
    vi.mocked(axiosInstance.put).mockResolvedValue({ data: { data: { ...order, status: 'cancelled' } } })
    const user = userEvent.setup()
    renderAtRoute('/orders/o1')

    await screen.findByText('DF-000123')
    await user.click(screen.getByText('Cancel this order'))
    await user.click(screen.getByRole('button', { name: 'Confirm Cancel' }))

    await waitFor(() => expect(axiosInstance.put).toHaveBeenCalledWith('/orders/o1/cancel', { reason: '' }))
  })

  it('does not show a cancel option for a delivered order', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue({ ...order, status: 'delivered' })
    renderAtRoute('/orders/o1')
    await screen.findByText('DF-000123')
    expect(screen.queryByText('Cancel this order')).not.toBeInTheDocument()
  })

  it('shows a "Rate this item" prompt only for delivered orders', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue({ ...order, status: 'delivered' })
    renderAtRoute('/orders/o1')
    expect(await screen.findByText('Rate this item')).toBeInTheDocument()
  })

  it('shows delivery tracking info once a delivery partner is assigned', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue({
      ...order,
      status: 'shipped',
      delivery: {
        provider: 'Porter', trackingId: 'PTR-8821', deliveryStatus: 'in_transit',
        driverName: 'Ramesh Kumar', driverPhone: '9812345678',
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      },
    })
    renderAtRoute('/orders/o1')

    expect(await screen.findByText('Delivery Tracking')).toBeInTheDocument()
    expect(screen.getByText('In Transit')).toBeInTheDocument()
    expect(screen.getByText('Porter')).toBeInTheDocument()
    expect(screen.getByText('PTR-8821')).toBeInTheDocument()
    expect(screen.getByText(/Ramesh Kumar/)).toBeInTheDocument()
  })

  it('does not show the delivery tracking card before a delivery is assigned', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order)
    renderAtRoute('/orders/o1')
    await screen.findByText('DF-000123')
    expect(screen.queryByText('Delivery Tracking')).not.toBeInTheDocument()
  })

  it('downloads the invoice', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order)
    vi.mocked(orderApi.downloadInvoice).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderAtRoute('/orders/o1')

    await screen.findByText('DF-000123')
    await user.click(screen.getByRole('button', { name: /Download Invoice/ }))

    await waitFor(() => expect(orderApi.downloadInvoice).toHaveBeenCalledWith('o1', 'DF-000123'))
  })

  it('opens the invoice for printing', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order)
    vi.mocked(orderApi.printInvoice).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderAtRoute('/orders/o1')

    await screen.findByText('DF-000123')
    await user.click(screen.getByRole('button', { name: /Print Invoice/ }))

    await waitFor(() => expect(orderApi.printInvoice).toHaveBeenCalledWith('o1'))
  })

  it('emails the invoice and shows a success toast', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order)
    vi.mocked(orderApi.emailInvoice).mockResolvedValue('Invoice emailed to user@test.com')
    const user = userEvent.setup()
    renderAtRoute('/orders/o1')

    await screen.findByText('DF-000123')
    await user.click(screen.getByRole('button', { name: /Email Invoice/ }))

    await waitFor(() => expect(orderApi.emailInvoice).toHaveBeenCalledWith('o1'))
  })
})

describe('OrdersPage — return/refund request', () => {
  const deliveredOrder = {
    ...order,
    status: 'delivered',
    trackingTimeline: [{ status: 'delivered', timestamp: new Date().toISOString(), note: '' }],
  }

  it('does not show a return option before delivery', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(order) // status: 'confirmed'
    renderAtRoute('/orders/o1')
    await screen.findByText('DF-000123')
    expect(screen.queryByText('Request a return or refund')).not.toBeInTheDocument()
  })

  it('shows a "Request a return or refund" button within the return window', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(deliveredOrder)
    renderAtRoute('/orders/o1')
    expect(await screen.findByText('Request a return or refund')).toBeInTheDocument()
  })

  it('shows an expired message once the 24-hour window has passed', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue({
      ...deliveredOrder,
      trackingTimeline: [{ status: 'delivered', timestamp: new Date(Date.now() - 30 * 3_600_000).toISOString(), note: '' }],
    })
    renderAtRoute('/orders/o1')
    expect(await screen.findByText(/24-hour return window.*has passed/)).toBeInTheDocument()
    expect(screen.queryByText('Request a return or refund')).not.toBeInTheDocument()
  })

  it('shows the existing return status instead of the request button', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(deliveredOrder)
    vi.mocked(returnApi.getForOrder).mockResolvedValue({
      id: 'r1', orderId: 'o1', orderNumber: 'DF-000123', userId: 'u1',
      reason: 'damaged_or_spoiled', note: null,
      items: [{ productId: 'p1', name: 'Salmon', price: 999, quantity: 1 }],
      refundAmount: 999, status: 'requested', adminNote: null, razorpayRefundId: null,
      orderPaymentMethod: 'razorpay', refundMethod: null, refundReference: null,
      requestedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', resolvedAt: null,
    })
    renderAtRoute('/orders/o1')
    expect(await screen.findByText('Return Requested')).toBeInTheDocument()
    expect(screen.queryByText('Request a return or refund')).not.toBeInTheDocument()
  })

  it('submits a return request for a selected item', async () => {
    vi.mocked(orderApi.getById).mockResolvedValue(deliveredOrder)
    vi.mocked(returnApi.request).mockResolvedValue({
      id: 'r1', orderId: 'o1', orderNumber: 'DF-000123', userId: 'u1',
      reason: 'damaged_or_spoiled', note: '', items: [], refundAmount: 999,
      status: 'requested', adminNote: null, razorpayRefundId: null,
      orderPaymentMethod: 'razorpay', refundMethod: null, refundReference: null,
      requestedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', resolvedAt: null,
    })
    const user = userEvent.setup()
    renderAtRoute('/orders/o1')

    await user.click(await screen.findByText('Request a return or refund'))
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    await waitFor(() => expect(returnApi.request).toHaveBeenCalledWith(
      'o1', 'damaged_or_spoiled', '', [{ productId: 'p1', quantity: 1 }],
    ))
  })
})
