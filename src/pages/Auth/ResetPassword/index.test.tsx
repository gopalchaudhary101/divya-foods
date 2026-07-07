import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import ResetPasswordPage from './index'
import { authApi } from '@/services/api/authApi'

vi.mock('@/services/api/authApi', () => ({
  authApi: { resetPassword: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResetPasswordPage', () => {
  it('shows an invalid-link screen when there is no token in the URL', () => {
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password' })

    expect(screen.getByText('Invalid reset link')).toBeInTheDocument()
    expect(screen.getByText('Request New Link')).toHaveAttribute('href', '/auth/forgot-password')
  })

  it('shows validation errors for an empty password', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password?token=abc123' })

    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(authApi.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password?token=abc123' })

    await user.type(screen.getByLabelText(/New password/), 'short')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(screen.getByText('Minimum 8 characters')).toBeInTheDocument()
  })

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password?token=abc123' })

    await user.type(screen.getByLabelText(/New password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm new password/), 'different123')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('submits the token and new password, then shows the success screen', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password?token=abc123' })

    await user.type(screen.getByLabelText(/New password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm new password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    await waitFor(() => expect(authApi.resetPassword).toHaveBeenCalledWith('abc123', 'password123'))
    expect(await screen.findByText('Password updated')).toBeInTheDocument()
  })

  it('shows an error toast when the reset fails', async () => {
    const toast = (await import('react-hot-toast')).default
    vi.mocked(authApi.resetPassword).mockRejectedValue(new Error('Token expired'))
    const user = userEvent.setup()
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password?token=abc123' })

    await user.type(screen.getByLabelText(/New password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm new password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Reset Password' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.queryByText('Password updated')).not.toBeInTheDocument()
  })

  it('toggles password visibility for both fields together', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ResetPasswordPage />, { route: '/auth/reset-password?token=abc123' })

    const passwordInput = screen.getByLabelText(/New password/) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    await user.click(screen.getByLabelText('Show password'))
    expect(passwordInput.type).toBe('text')
  })
})
