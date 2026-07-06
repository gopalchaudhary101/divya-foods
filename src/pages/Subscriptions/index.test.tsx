import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import SubscriptionsPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)
beforeEach(() => mock.reset())

const sub = {
  id: 's1', productId: 'p1', productName: 'Salmon', productImage: null, productPrice: 1000,
  quantity: 1, frequency: 'monthly' as const, status: 'active' as const, discountPct: 10,
  nextDelivery: '2026-02-01', createdAt: '2026-01-01',
}

describe('SubscriptionsPage', () => {
  it('shows an empty state with no subscriptions', async () => {
    mock.onGet('/subscriptions').reply(200, { success: true, data: [] })
    renderWithProviders(<SubscriptionsPage />)
    expect(await screen.findByText('No active subscriptions')).toBeInTheDocument()
  })

  it('renders a subscription with discounted price and status', async () => {
    mock.onGet('/subscriptions').reply(200, { success: true, data: [sub] })
    renderWithProviders(<SubscriptionsPage />)

    expect(await screen.findByText('Salmon')).toBeInTheDocument()
    expect(screen.getByText('₹900')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('pauses an active subscription', async () => {
    mock.onGet('/subscriptions').reply(200, { success: true, data: [sub] })
    mock.onPut('/subscriptions/s1').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<SubscriptionsPage />)

    await screen.findByText('Salmon')
    await user.click(screen.getByTitle('Pause'))

    await waitFor(() => expect(mock.history.put[0].data).toBe(JSON.stringify({ status: 'paused' })))
  })

  it('changes delivery frequency', async () => {
    mock.onGet('/subscriptions').reply(200, { success: true, data: [sub] })
    mock.onPut('/subscriptions/s1').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<SubscriptionsPage />)

    await screen.findByText('Salmon')
    await user.click(screen.getByRole('button', { name: 'Weekly' }))

    await waitFor(() => expect(mock.history.put[0].data).toBe(JSON.stringify({ frequency: 'weekly' })))
  })

  it('cancels a subscription after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mock.onGet('/subscriptions').reply(200, { success: true, data: [sub] })
    mock.onDelete('/subscriptions/s1').reply(204)
    const user = userEvent.setup()
    renderWithProviders(<SubscriptionsPage />)

    await screen.findByText('Salmon')
    await user.click(screen.getByTitle('Cancel subscription'))

    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
  })

  it('does not cancel if the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mock.onGet('/subscriptions').reply(200, { success: true, data: [sub] })
    const user = userEvent.setup()
    renderWithProviders(<SubscriptionsPage />)

    await screen.findByText('Salmon')
    await user.click(screen.getByTitle('Cancel subscription'))

    expect(mock.history.delete ?? []).toHaveLength(0)
  })
})
