import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import ReferralPage from './index'
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
})

describe('ReferralPage', () => {
  it('prompts guests to sign in', () => {
    renderWithProviders(<ReferralPage />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
  })

  it('shows the referral code and signup stats for an authenticated user', async () => {
    mock.onGet('/referrals/my').reply(200, { success: true, data: { code: 'ABC123', signups: 3, creditPerSignup: 100 } })
    renderWithProviders(<ReferralPage />, { preloadedState: authedState })

    expect(await screen.findByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('₹300')).toBeInTheDocument()
  })

  it('copies the referral code to the clipboard', async () => {
    mock.onGet('/referrals/my').reply(200, { success: true, data: { code: 'ABC123', signups: 0, creditPerSignup: 100 } })
    const user = userEvent.setup()
    // userEvent.setup() installs its own clipboard stub, replacing anything set
    // beforehand — spy on it only after setup() has run.
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    renderWithProviders(<ReferralPage />, { preloadedState: authedState })

    await screen.findByText('ABC123')
    await user.click(screen.getByLabelText('Copy code'))

    expect(writeSpy).toHaveBeenCalledWith('ABC123')
  })

  it('requires at least 4 characters before allowing redemption', async () => {
    mock.onGet('/referrals/my').reply(200, { success: true, data: { code: 'ABC123', signups: 0, creditPerSignup: 100 } })
    const user = userEvent.setup()
    renderWithProviders(<ReferralPage />, { preloadedState: authedState })

    await screen.findByText('ABC123')
    const redeemButton = screen.getByRole('button', { name: /Redeem/ })
    expect(redeemButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Enter referral code'), 'XYZ9')
    expect(redeemButton).not.toBeDisabled()
  })

  it('redeems a friend\'s code', async () => {
    mock.onGet('/referrals/my').reply(200, { success: true, data: { code: 'ABC123', signups: 0, creditPerSignup: 100 } })
    mock.onPost('/referrals/redeem').reply(200, { success: true, data: { coupon: 'REFXYZ', discount: 100 } })
    const user = userEvent.setup()
    renderWithProviders(<ReferralPage />, { preloadedState: authedState })

    await screen.findByText('ABC123')
    await user.type(screen.getByPlaceholderText('Enter referral code'), 'XYZ999')
    await user.click(screen.getByRole('button', { name: /Redeem/ }))

    expect(await screen.findByPlaceholderText('Enter referral code')).toHaveValue('')
  })
})
