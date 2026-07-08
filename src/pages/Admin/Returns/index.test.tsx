import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminReturnsPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const returnRequest = {
  id: 'r1', orderId: 'o1', orderNumber: 'DF-001', userId: 'u1',
  reason: 'damaged_or_spoiled', note: 'Fish arrived warm', status: 'requested',
  items: [{ productId: 'p1', name: 'Salmon Fillet', price: 999, quantity: 1 }],
  refundAmount: 999, adminNote: null, razorpayRefundId: null,
  requestedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', resolvedAt: null,
}

beforeEach(() => {
  mock.reset()
  mock.onGet(/\/admin\/returns/).reply(200, { data: [returnRequest], total: 1, page: 1, totalPages: 1 })
})

describe('AdminReturnsPage', () => {
  it('lists return requests', async () => {
    renderWithProviders(<AdminReturnsPage />)
    expect(await screen.findByText('DF-001')).toBeInTheDocument()
    expect(screen.getByText('Damaged or spoiled on arrival')).toBeInTheDocument()
    expect(screen.getByText('₹999')).toBeInTheDocument()
  })

  it('shows an empty state with no returns', async () => {
    mock.onGet(/\/admin\/returns/).reply(200, { data: [], total: 0, page: 1, totalPages: 0 })
    renderWithProviders(<AdminReturnsPage />)
    expect(await screen.findByText('No return requests')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminReturnsPage />)
    await screen.findByText('DF-001')

    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'rejected')

    await waitFor(() => {
      const lastCall = mock.history.get[mock.history.get.length - 1]
      expect(lastCall.params.status).toBe('rejected')
    })
  })

  it('filters by search term', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminReturnsPage />)
    await screen.findByText('DF-001')

    await user.type(screen.getByPlaceholderText('Search order number…'), 'DF-001')

    await waitFor(() => {
      const lastCall = mock.history.get[mock.history.get.length - 1]
      expect(lastCall.params.search).toBe('DF-001')
    })
  })

  it('opens the detail modal and shows the requested items and reason', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminReturnsPage />)

    await user.click(await screen.findByText('DF-001'))

    expect(await screen.findByText(/Salmon Fillet/)).toBeInTheDocument()
    expect(screen.getByText(/Fish arrived warm/)).toBeInTheDocument()
    expect(screen.getByText('Refund amount: ₹999')).toBeInTheDocument()
  })

  it('disables the reject button until a note is entered', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminReturnsPage />)

    await user.click(await screen.findByText('DF-001'))
    const rejectButton = await screen.findByRole('button', { name: 'Reject' })
    expect(rejectButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText(/Explain your decision/), 'Not eligible')
    expect(rejectButton).not.toBeDisabled()
  })

  it('rejects a return request with a note', async () => {
    mock.onPut('/admin/returns/r1/reject').reply(200, { success: true, data: { ...returnRequest, status: 'rejected', adminNote: 'Not eligible' } })
    const user = userEvent.setup()
    renderWithProviders(<AdminReturnsPage />)

    await user.click(await screen.findByText('DF-001'))
    await user.type(screen.getByPlaceholderText(/Explain your decision/), 'Not eligible')
    await user.click(screen.getByRole('button', { name: 'Reject' }))

    await waitFor(() => expect(mock.history.put[0].data).toBe(
      JSON.stringify({ note: 'Not eligible' })
    ))
  })

  it('approves a return request and triggers a refund', async () => {
    mock.onPut('/admin/returns/r1/approve').reply(200, { success: true, data: { ...returnRequest, status: 'refunded' } })
    const user = userEvent.setup()
    renderWithProviders(<AdminReturnsPage />)

    await user.click(await screen.findByText('DF-001'))
    await user.click(screen.getByRole('button', { name: /Approve/ }))

    await waitFor(() => expect(mock.history.put[0].url).toBe('/admin/returns/r1/approve'))
  })

  it('hides approve/reject actions for an already-resolved return', async () => {
    mock.onGet(/\/admin\/returns/).reply(200, {
      data: [{ ...returnRequest, status: 'refunded', razorpayRefundId: 'rfnd_1' }], total: 1, page: 1, totalPages: 1,
    })
    const user = userEvent.setup()
    renderWithProviders(<AdminReturnsPage />)

    await user.click(await screen.findByText('DF-001'))
    await screen.findByText(/Salmon Fillet/)
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  })
})
