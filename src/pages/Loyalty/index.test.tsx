import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import LoyaltyPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)
beforeEach(() => mock.reset())

const balance = {
  earned: 999, bonusPoints: 0, redeemed: 0, available: 999, discountPerPoint: 0.1, minRedeem: 100,
  birthdayBonusGranted: false, birthdayBonusPoints: 500, recentOrders: [],
}

const silverMembership = {
  tier: 'Silver', lifetimeSpend: 0, nextTier: 'Gold', amountToNextTier: 10000,
  perks: { freeDelivery: false, freeDeliveryAbove: null },
}

describe('LoyaltyPage', () => {
  it('renders earned/redeemed/available balances', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: balance })
    renderWithProviders(<LoyaltyPage />)

    expect((await screen.findAllByText('999')).length).toBeGreaterThan(0)
    expect(screen.getByText('Earned')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('hides the redeem panel when available points are below the minimum', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: { ...balance, available: 50 } })
    renderWithProviders(<LoyaltyPage />)

    await screen.findByText('Earned')
    expect(screen.queryByText('Redeem Points')).not.toBeInTheDocument()
  })

  it('shows a discount preview as the user types a valid point amount', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: balance })
    const user = userEvent.setup()
    renderWithProviders(<LoyaltyPage />)

    await screen.findByText('Redeem Points')
    await user.type(screen.getByPlaceholderText('Min 100 pts'), '200')

    expect(screen.getByText("You'll get ₹20.00 discount")).toBeInTheDocument()
  })

  it('disables Redeem for an amount not in multiples of 100', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: balance })
    const user = userEvent.setup()
    renderWithProviders(<LoyaltyPage />)

    await screen.findByText('Redeem Points')
    await user.type(screen.getByPlaceholderText('Min 100 pts'), '150')

    expect(screen.getByRole('button', { name: 'Redeem' })).toBeDisabled()
  })

  it('redeems points successfully', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: balance })
    mock.onPost('/loyalty/redeem').reply(200, { success: true, data: { pointsUsed: 200, discount: 20 } })
    const user = userEvent.setup()
    renderWithProviders(<LoyaltyPage />)

    await screen.findByText('Redeem Points')
    await user.type(screen.getByPlaceholderText('Min 100 pts'), '200')
    await user.click(screen.getByRole('button', { name: 'Redeem' }))

    expect(await screen.findByText('Redeemed 200 points for ₹20 off!')).toBeInTheDocument()
  })

  it('shows recent earning history when present', async () => {
    mock.onGet('/loyalty/balance').reply(200, {
      success: true,
      data: { ...balance, recentOrders: [{ orderNumber: 'DF-001', total: 999, points: 999, date: '2026-01-01' }] },
    })
    renderWithProviders(<LoyaltyPage />)

    expect(await screen.findByText(/Order #DF-001/)).toBeInTheDocument()
  })

  it('shows the membership tier card with progress to the next tier', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: balance })
    mock.onGet('/loyalty/membership').reply(200, { success: true, data: silverMembership })
    renderWithProviders(<LoyaltyPage />)

    expect(await screen.findByText('Silver Member')).toBeInTheDocument()
    expect(screen.getByText(/Spend .*more to reach Gold/)).toBeInTheDocument()
  })

  it('shows a free-delivery perk for Gold members', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: balance })
    mock.onGet('/loyalty/membership').reply(200, {
      success: true,
      data: { tier: 'Gold', lifetimeSpend: 12000, nextTier: 'Platinum', amountToNextTier: 18000, perks: { freeDelivery: false, freeDeliveryAbove: 499 } },
    })
    renderWithProviders(<LoyaltyPage />)

    expect(await screen.findByText('Gold Member')).toBeInTheDocument()
    expect(screen.getByText(/free delivery on orders above/)).toBeInTheDocument()
  })

  it('shows a birthday bonus banner when just granted', async () => {
    mock.onGet('/loyalty/balance').reply(200, {
      success: true,
      data: { ...balance, birthdayBonusGranted: true, bonusPoints: 500 },
    })
    renderWithProviders(<LoyaltyPage />)

    expect(await screen.findByText(/Happy Birthday!/)).toBeInTheDocument()
  })

  it('does not show a birthday banner on a normal day', async () => {
    mock.onGet('/loyalty/balance').reply(200, { success: true, data: balance })
    renderWithProviders(<LoyaltyPage />)

    await screen.findByText('Earned')
    expect(screen.queryByText(/Happy Birthday!/)).not.toBeInTheDocument()
  })
})
