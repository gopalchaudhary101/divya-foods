import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import LoginPage from './index'
import { authApi } from '@/services/api/authApi'

vi.mock('@/services/api/authApi', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('LoginPage', () => {
  it('shows validation errors for empty fields on submit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/Email address/), 'not-an-email')
    await user.type(screen.getByLabelText(/^Password/), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument()
  })

  it('rejects a too-short password', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/Email address/), 'a@test.com')
    await user.type(screen.getByLabelText(/^Password/), '123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Minimum 6 characters')).toBeInTheDocument()
  })

  it('submits valid credentials', async () => {
    const user = { id: 'u1', name: 'Priya', email: 'p@test.com', role: 'customer' as const, createdAt: '' }
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', user,
    })
    const u = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await u.type(screen.getByLabelText(/Email address/), 'p@test.com')
    await u.type(screen.getByLabelText(/^Password/), 'password123')
    await u.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith({
      email: 'p@test.com', password: 'password123',
    }))
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    const passwordInput = screen.getByLabelText(/^Password/) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    await user.click(screen.getByLabelText('Show password'))
    expect(passwordInput.type).toBe('text')

    await user.click(screen.getByLabelText('Hide password'))
    expect(passwordInput.type).toBe('password')
  })

  it('clears the field error as soon as the user starts typing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(screen.getByText('Email is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Email address/), 'a')
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
  })

  it('links to the register page', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByText('Create one free')).toHaveAttribute('href', '/auth/register')
  })
})
