import { describe, it, expect, beforeEach } from 'vitest'
import reducer, { setCredentials, setLoading, logout } from './authSlice'
import type { User } from '@/types'

const user: User = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'customer',
  phone: '9999999999',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('authSlice', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts unauthenticated with no user', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setCredentials logs the user in and persists the token to localStorage', () => {
    const state = reducer(undefined, setCredentials({ user, token: 'tok123' }))
    expect(state.isAuthenticated).toBe(true)
    expect(state.user).toEqual(user)
    expect(state.token).toBe('tok123')
    expect(localStorage.getItem('access_token')).toBe('tok123')
  })

  it('setLoading toggles the loading flag', () => {
    let state = reducer(undefined, setLoading(true))
    expect(state.isLoading).toBe(true)
    state = reducer(state, setLoading(false))
    expect(state.isLoading).toBe(false)
  })

  it('logout clears user state and localStorage tokens', () => {
    localStorage.setItem('access_token', 'tok123')
    localStorage.setItem('refresh_token', 'refresh123')

    let state = reducer(undefined, setCredentials({ user, token: 'tok123' }))
    state = reducer(state, logout())

    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
