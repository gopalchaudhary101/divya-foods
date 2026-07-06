import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import ProfilePage from './index'
import { userApi } from '@/services/api/userApi'
import { orderApi } from '@/services/api/orderApi'
import axiosInstance from '@/services/api/axiosInstance'

vi.mock('@/services/api/userApi', () => ({
  userApi: { getAddresses: vi.fn(), updateProfile: vi.fn(), addAddress: vi.fn(), updateAddress: vi.fn(), deleteAddress: vi.fn() },
}))
vi.mock('@/services/api/orderApi', () => ({
  orderApi: { getMyOrders: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const mock = new MockAdapter(axiosInstance)

const authedState = {
  auth: {
    user: { id: 'u1', name: 'Priya Sharma', email: 'priya@test.com', phone: '9999999999', role: 'customer' as const, createdAt: '2026-01-01T00:00:00Z' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

const address = {
  id: 'a1', label: 'Home', fullName: 'Priya Sharma', phone: '9999999999',
  addressLine1: 'Street 1', city: 'Delhi', state: 'Delhi', pincode: '110001', isDefault: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.reset()
  vi.mocked(userApi.getAddresses).mockResolvedValue([])
  vi.mocked(orderApi.getMyOrders).mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 })
})

describe('ProfilePage', () => {
  it('prompts guests to log in', () => {
    renderWithProviders(<ProfilePage />)
    expect(screen.getByText('Please log in to view your profile')).toBeInTheDocument()
  })

  it('renders user info', async () => {
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })
    expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThan(0)
    expect(screen.getAllByText('priya@test.com').length).toBeGreaterThan(0)
  })

  it('edits and saves the profile', async () => {
    vi.mocked(userApi.updateProfile).mockResolvedValue({
      id: 'u1', name: 'New Name', email: 'priya@test.com', role: 'customer', createdAt: '2026-01-01T00:00:00Z',
    })
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    await user.click(screen.getByRole('button', { name: /Edit Profile/ }))
    const nameInput = screen.getByLabelText('Full Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(userApi.updateProfile).toHaveBeenCalledWith({ name: 'New Name', phone: '9999999999' }))
  })

  it('saves a date of birth for birthday loyalty rewards', async () => {
    vi.mocked(userApi.updateProfile).mockResolvedValue({
      id: 'u1', name: 'Priya Sharma', email: 'priya@test.com', role: 'customer',
      date_of_birth: '1995-08-15', createdAt: '2026-01-01T00:00:00Z',
    })
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    await user.click(screen.getByRole('button', { name: /Edit Profile/ }))
    await user.type(screen.getByLabelText('Date of Birth'), '1995-08-15')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(userApi.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ date_of_birth: '1995-08-15' }),
    ))
  })

  it('shows an empty state and adds a new address', async () => {
    vi.mocked(userApi.addAddress).mockResolvedValue(address)
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    expect(screen.getByText('No saved addresses yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Add New Address/ }))

    expect(screen.getByRole('heading', { name: 'Add New Address' })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Recipient name'), 'Priya Sharma')
    await user.type(screen.getByPlaceholderText('+91 9999999999'), '9999999999')
    await user.type(screen.getByPlaceholderText('House no., street, area'), 'Street 1')
    await user.type(screen.getByPlaceholderText('City'), 'Delhi')
    await user.type(screen.getByPlaceholderText('110001'), '110001')
    await user.click(screen.getByRole('button', { name: 'Save Address' }))

    await waitFor(() => expect(userApi.addAddress).toHaveBeenCalled())
  })

  it('lists saved addresses and deletes one after confirmation', async () => {
    vi.mocked(userApi.getAddresses).mockResolvedValue([address])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    expect(await screen.findByText('Street 1, Delhi, Delhi — 110001')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Delete'))

    await waitFor(() => expect(userApi.deleteAddress).toHaveBeenCalled())
    expect(vi.mocked(userApi.deleteAddress).mock.calls[0][0]).toBe('a1')
  })

  it('shows recent orders', async () => {
    vi.mocked(orderApi.getMyOrders).mockResolvedValue({
      data: [{
        id: 'o1', orderNumber: 'DF-001', status: 'delivered', paymentStatus: 'paid', paymentMethod: 'razorpay',
        deliveryAddress: address, items: [], subtotal: 999, deliveryCharge: 0, discount: 0, total: 999,
        trackingTimeline: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }],
      total: 1, page: 1, totalPages: 1,
    })
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    expect(await screen.findByText('Order #DF-001')).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()
  })

  it('validates password change fields', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    await user.click(screen.getByRole('button', { name: /Change Password/ }))
    await user.type(screen.getByLabelText('New Password'), 'newpassword')
    await user.type(screen.getByLabelText('Confirm New Password'), 'different')

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeDisabled()
  })

  it('changes password successfully', async () => {
    mock.onPost('/auth/change-password').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    await user.click(screen.getByRole('button', { name: /Change Password/ }))
    await user.type(screen.getByLabelText('Current Password'), 'oldpassword')
    await user.type(screen.getByLabelText('New Password'), 'newpassword')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpassword')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => expect(mock.history.post[0].data).toBe(
      JSON.stringify({ current_password: 'oldpassword', new_password: 'newpassword' })
    ))
  })

  it('signs out when clicked', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<ProfilePage />, { preloadedState: authedState })

    await user.click(screen.getByRole('button', { name: /Sign Out/ }))

    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(false))
  })
})
