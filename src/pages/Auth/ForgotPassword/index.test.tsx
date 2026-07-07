import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import ForgotPasswordPage from './index'
import { authApi } from '@/services/api/authApi'

vi.mock('@/services/api/authApi', () => ({
  authApi: { forgotPassword: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForgotPasswordPage', () => {
  it('shows a validation error for an empty email', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ForgotPasswordPage />)

    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(authApi.forgotPassword).not.toHaveBeenCalled()
  })

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/Email address/), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
  })

  it('submits a valid email and shows the confirmation screen', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/Email address/), 'priya@test.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    await waitFor(() => expect(authApi.forgotPassword).toHaveBeenCalledWith('priya@test.com'))
    expect(await screen.findByText('Check your email')).toBeInTheDocument()
    expect(screen.getByText('priya@test.com')).toBeInTheDocument()
  })

  it('shows an error toast when the request fails', async () => {
    const toast = (await import('react-hot-toast')).default
    vi.mocked(authApi.forgotPassword).mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    renderWithProviders(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/Email address/), 'priya@test.com')
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument()
  })

  it('links back to the login page', () => {
    renderWithProviders(<ForgotPasswordPage />)
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/auth/login')
  })
})
