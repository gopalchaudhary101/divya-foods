import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { authApi } from './authApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('authApi', () => {
  it('login posts credentials and returns the token payload', async () => {
    mock.onPost('/auth/login', { email: 'a@test.com', password: 'pw' }).reply(200, {
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer',
      user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', created_at: '' },
    })
    const result = await authApi.login({ email: 'a@test.com', password: 'pw' })
    expect(result.access_token).toBe('tok')
    expect(result.user.email).toBe('a@test.com')
  })

  it('register posts the signup payload', async () => {
    mock.onPost('/auth/register').reply(201, {
      access_token: 'tok', refresh_token: 'ref', token_type: 'bearer',
      user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', created_at: '' },
    })
    const result = await authApi.register({ name: 'A', email: 'a@test.com', phone: '999', password: 'pw' })
    expect(result.user.name).toBe('A')
  })

  it('logout posts with no body', async () => {
    mock.onPost('/auth/logout').reply(204)
    await expect(authApi.logout()).resolves.toBeUndefined()
  })

  it('getMe returns the raw user object and normalizes created_at to createdAt', async () => {
    mock.onGet('/auth/me').reply(200, {
      id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', created_at: '2026-01-01T00:00:00Z',
    })
    const user = await authApi.getMe()
    expect(user).toEqual({
      id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('forgotPassword posts the email', async () => {
    mock.onPost('/auth/forgot-password', { email: 'a@test.com' }).reply(200)
    await expect(authApi.forgotPassword('a@test.com')).resolves.toBeUndefined()
  })

  it('resetPassword posts token and new_password (snake_case)', async () => {
    mock.onPost('/auth/reset-password', { token: 'tok123', new_password: 'newpw' }).reply(200)
    await expect(authApi.resetPassword('tok123', 'newpw')).resolves.toBeUndefined()
  })
})
