import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import RegisterPage from './index'
import { authApi } from '@/services/api/authApi'

vi.mock('@/services/api/authApi', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('RegisterPage', () => {
  it('shows validation errors for all empty required fields', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Phone number is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(screen.getByText('Please confirm your password')).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('rejects an Indian mobile number that does not start with 6-9', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)
    await user.type(screen.getByLabelText(/Mobile number/), '1234567890')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(screen.getByText('Enter a valid 10-digit Indian mobile number')).toBeInTheDocument()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)
    await user.type(screen.getByLabelText(/^Password/), 'short')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(screen.getByText('Minimum 8 characters')).toBeInTheDocument()
  })

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)
    await user.type(screen.getByLabelText(/^Password/), 'password123')
    await user.type(screen.getByLabelText(/Confirm password/), 'different123')
    await user.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('submits a valid registration, trimming the name', async () => {
    const user = { id: 'u1', name: 'Priya Sharma', email: 'priya@test.com', role: 'customer' as const, createdAt: '' }
    vi.mocked(authApi.register).mockResolvedValue({
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', user,
    })
    const u = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await u.type(screen.getByLabelText(/Full name/), '  Priya Sharma  ')
    await u.type(screen.getByLabelText(/Email address/), 'priya@test.com')
    await u.type(screen.getByLabelText(/Mobile number/), '9876543210')
    await u.type(screen.getByLabelText(/^Password/), 'password123')
    await u.type(screen.getByLabelText(/Confirm password/), 'password123')
    await u.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(authApi.register).toHaveBeenCalledWith({
      name: 'Priya Sharma', email: 'priya@test.com', phone: '9876543210', password: 'password123',
    }))
  })

  it('links to the login page', () => {
    renderWithProviders(<RegisterPage />)
    expect(screen.getByText('Sign in')).toHaveAttribute('href', '/auth/login')
  })
})
