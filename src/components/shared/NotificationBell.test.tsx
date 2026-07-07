import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import { NotificationBell } from './NotificationBell'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const authedState = {
  auth: {
    user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

beforeEach(() => {
  mock.reset()
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: 0 })
  mock.onGet('/notifications').reply(200, { success: true, data: [] })
})

describe('NotificationBell', () => {
  it('renders nothing for an unauthenticated user', () => {
    const { container } = renderWithProviders(<NotificationBell />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the unread count badge for an authenticated user', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: 3 })
    renderWithProviders(<NotificationBell />, { preloadedState: authedState })
    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('caps the displayed badge at "9+"', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: 15 })
    renderWithProviders(<NotificationBell />, { preloadedState: authedState })
    expect(await screen.findByText('9+')).toBeInTheDocument()
  })

  it('opens the dropdown and shows "No notifications yet" when the list is empty', async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />, { preloadedState: authedState })

    await user.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument()
  })

  it('lists notifications once loaded', async () => {
    mock.onGet('/notifications').reply(200, {
      success: true,
      data: [{
        id: 'n1', type: 'order_update', title: 'Order shipped', message: 'Your order is on the way',
        is_read: false, data: {}, created_at: new Date().toISOString(),
      }],
    })
    const user = userEvent.setup()
    renderWithProviders(<NotificationBell />, { preloadedState: authedState })

    await user.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Order shipped')).toBeInTheDocument()
  })

  it('closes the dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <div>
        <NotificationBell />
        <button>Outside</button>
      </div>,
      { preloadedState: authedState }
    )

    await user.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument()

    await user.click(screen.getByText('Outside'))
    await waitFor(() => expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument())
  })
})
