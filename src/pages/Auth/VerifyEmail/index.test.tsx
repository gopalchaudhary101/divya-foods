import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/testUtils'
import VerifyEmailPage from './index'
import { authApi } from '@/services/api/authApi'

vi.mock('@/services/api/authApi', () => ({
  authApi: { verifyEmail: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VerifyEmailPage', () => {
  it('shows an invalid-link screen when there is no token in the URL', () => {
    renderWithProviders(<VerifyEmailPage />, { route: '/auth/verify-email' })

    expect(screen.getByText('Invalid verification link')).toBeInTheDocument()
    expect(authApi.verifyEmail).not.toHaveBeenCalled()
  })

  it('shows a verifying state, then success once the API call resolves', async () => {
    vi.mocked(authApi.verifyEmail).mockResolvedValue(undefined)
    renderWithProviders(<VerifyEmailPage />, { route: '/auth/verify-email?token=abc123' })

    expect(screen.getByText('Verifying your email…')).toBeInTheDocument()
    expect(await screen.findByText('Email verified')).toBeInTheDocument()
    expect(authApi.verifyEmail).toHaveBeenCalledWith('abc123')
  })

  it('shows an error screen — but still lets the customer keep shopping — when the token is invalid or expired', async () => {
    vi.mocked(authApi.verifyEmail).mockRejectedValue({
      response: { data: { detail: 'This verification link is invalid or has expired.' } },
    })
    renderWithProviders(<VerifyEmailPage />, { route: '/auth/verify-email?token=expired' })

    expect(await screen.findByText('Link invalid or expired')).toBeInTheDocument()
    expect(screen.getByText(/you can still shop and order normally/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue Shopping' })).toBeInTheDocument()
  })
})
