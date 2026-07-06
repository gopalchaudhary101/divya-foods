import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import toast from 'react-hot-toast'
import { useAuth } from './useAuth'
import { authApi } from '@/services/api/authApi'
import { createTestStore } from '@/test/testUtils'
import { ROUTES } from '@/constants/routes'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/services/api/authApi', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const store = createTestStore()
  return <Provider store={store}>{children}</Provider>
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('useAuth', () => {
  it('login dispatches credentials, stores refresh token, and navigates home', async () => {
    const user = { id: 'u1', name: 'Priya', email: 'p@test.com', role: 'customer' as const, createdAt: '' }
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', user,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login({ email: 'p@test.com', password: 'pw' })
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(user)
    expect(localStorage.getItem('refresh_token')).toBe('ref')
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.HOME)
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Priya'))
  })

  it('login shows an error toast and re-throws on failure', async () => {
    vi.mocked(authApi.login).mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'Invalid credentials.' } },
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await expect(
      act(async () => {
        await result.current.login({ email: 'p@test.com', password: 'wrong' })
      })
    ).rejects.toBeTruthy()

    expect(toast.error).toHaveBeenCalledWith('Invalid credentials.')
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('register logs the new user in and navigates home', async () => {
    const user = { id: 'u2', name: 'Rahul', email: 'r@test.com', role: 'customer' as const, createdAt: '' }
    vi.mocked(authApi.register).mockResolvedValue({
      access_token: 'tok2', refresh_token: 'ref2', token_type: 'bearer', user,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.register({ name: 'Rahul', email: 'r@test.com', phone: '999', password: 'pw' })
    })

    expect(result.current.user?.name).toBe('Rahul')
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.HOME)
  })

  it('logout clears state and navigates to login even if the server call fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.logout()
    })

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN)
    expect(toast.success).toHaveBeenCalledWith('Logged out successfully')
  })

  it('isAdmin reflects the user role', async () => {
    const admin = { id: 'u3', name: 'Admin', email: 'a@test.com', role: 'admin' as const, createdAt: '' }
    vi.mocked(authApi.login).mockResolvedValue({
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer', user: admin,
    })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login({ email: 'a@test.com', password: 'pw' })
    })

    expect(result.current.isAdmin).toBe(true)
  })
})
