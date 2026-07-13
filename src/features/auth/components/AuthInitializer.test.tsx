import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { AuthInitializer } from './AuthInitializer'
import { authApi } from '@/services/api/authApi'
import { createTestStore } from '@/test/testUtils'

vi.mock('@/services/api/authApi', () => ({
  authApi: { getMe: vi.fn() },
}))

function renderWithStore() {
  const store = createTestStore()
  render(
    <Provider store={store}>
      <AuthInitializer>
        <div>App Content</div>
      </AuthInitializer>
    </Provider>
  )
  return store
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('AuthInitializer', () => {
  it('renders children immediately when there is no stored token', () => {
    renderWithStore()
    expect(screen.getByText('App Content')).toBeInTheDocument()
  })

  it('shows a loading spinner while validating a stored token, then renders children on success', async () => {
    localStorage.setItem('access_token', 'valid-token')
    const user = { id: 'u1', name: 'Priya', email: 'p@test.com', role: 'customer' as const, createdAt: '' }
    vi.mocked(authApi.getMe).mockResolvedValue(user)

    const store = renderWithStore()

    expect(screen.getByText(/Loading Divya Foods/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('App Content')).toBeInTheDocument())
    expect(store.getState().auth.isAuthenticated).toBe(true)
    expect(store.getState().auth.user).toEqual(user)
  })

  it('logs out and clears state when the stored token is invalid', async () => {
    localStorage.setItem('access_token', 'expired-token')
    vi.mocked(authApi.getMe).mockRejectedValue(new Error('401'))

    const store = renderWithStore()

    await waitFor(() => expect(screen.getByText('App Content')).toBeInTheDocument())
    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(store.getState().auth.user).toBeNull()
  })
})
