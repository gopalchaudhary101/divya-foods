import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import DriverDashboardPage from './index'
import { driverApi } from '@/services/api/driverApi'
import type { Order } from '@/services/api/orderApi'

vi.mock('@/services/api/driverApi', () => ({
  driverApi: { getMyOrders: vi.fn(), updateStatus: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const driverState = {
  auth: {
    user: { id: 'd1', name: 'Ravi Driver', email: 'ravi@test.com', role: 'driver' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1', orderNumber: 'DF-000123', status: 'confirmed', paymentStatus: 'paid',
    paymentMethod: 'razorpay',
    deliveryAddress: {
      label: 'Home', fullName: 'Priya', phone: '9999999999', addressLine1: 'Street 1',
      city: 'Delhi', state: 'Delhi', pincode: '110001',
    },
    items: [{ productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: '' }],
    subtotal: 999, deliveryCharge: 0, discount: 0, total: 999,
    trackingTimeline: [],
    delivery: {
      deliveryStatus: 'packed', driverId: 'd1', driverName: 'Ravi Driver',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    deliverySlot: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('DriverDashboardPage', () => {
  it('shows an empty state when no orders are assigned', async () => {
    vi.mocked(driverApi.getMyOrders).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 })
    renderWithProviders(<DriverDashboardPage />, { preloadedState: driverState })

    expect(await screen.findByText('No orders assigned right now')).toBeInTheDocument()
  })

  it('lists assigned orders with their current status', async () => {
    vi.mocked(driverApi.getMyOrders).mockResolvedValue({ data: [makeOrder()], total: 1, page: 1, totalPages: 1 })
    renderWithProviders(<DriverDashboardPage />, { preloadedState: driverState })

    expect(await screen.findByText('DF-000123')).toBeInTheDocument()
    expect(screen.getAllByText('Packed').length).toBeGreaterThan(0)   // status badge + filter tab both say "Packed"
    expect(screen.getByText(/Priya/)).toBeInTheDocument()
  })

  it('advances a packed order to ready for pickup', async () => {
    vi.mocked(driverApi.getMyOrders).mockResolvedValue({ data: [makeOrder()], total: 1, page: 1, totalPages: 1 })
    vi.mocked(driverApi.updateStatus).mockResolvedValue(makeOrder({ delivery: { deliveryStatus: 'ready_for_pickup', createdAt: '', updatedAt: '' } }))
    const user = userEvent.setup()
    renderWithProviders(<DriverDashboardPage />, { preloadedState: driverState })

    await screen.findByText('DF-000123')
    await user.click(screen.getByRole('button', { name: 'Mark Ready for Pickup' }))

    await waitFor(() => expect(driverApi.updateStatus).toHaveBeenCalledWith('o1', 'ready_for_pickup', undefined, undefined))
  })

  it('reports a failed delivery', async () => {
    vi.mocked(driverApi.getMyOrders).mockResolvedValue({
      data: [makeOrder({ delivery: { deliveryStatus: 'in_transit', createdAt: '', updatedAt: '' } })],
      total: 1, page: 1, totalPages: 1,
    })
    vi.mocked(driverApi.updateStatus).mockResolvedValue(makeOrder())
    const user = userEvent.setup()
    renderWithProviders(<DriverDashboardPage />, { preloadedState: driverState })

    await screen.findByText('DF-000123')
    await user.click(screen.getByRole('button', { name: 'Report Failed Delivery' }))

    await waitFor(() => expect(driverApi.updateStatus).toHaveBeenCalledWith('o1', 'failed', undefined, undefined))
  })

  it('does not show action buttons for a delivered order', async () => {
    vi.mocked(driverApi.getMyOrders).mockResolvedValue({
      data: [makeOrder({ delivery: { deliveryStatus: 'delivered', createdAt: '', updatedAt: '' } })],
      total: 1, page: 1, totalPages: 1,
    })
    renderWithProviders(<DriverDashboardPage />, { preloadedState: driverState })

    await screen.findByText('DF-000123')
    expect(screen.queryByRole('button', { name: /Report Failed Delivery/ })).not.toBeInTheDocument()
  })

  it('filters orders by delivery status', async () => {
    vi.mocked(driverApi.getMyOrders).mockResolvedValue({ data: [makeOrder()], total: 1, page: 1, totalPages: 1 })
    const user = userEvent.setup()
    renderWithProviders(<DriverDashboardPage />, { preloadedState: driverState })

    await screen.findByText('DF-000123')
    await user.click(screen.getByRole('button', { name: 'In Transit' }))

    await waitFor(() => expect(driverApi.getMyOrders).toHaveBeenCalledWith('in_transit'))
  })
})
