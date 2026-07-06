import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'

// Both the shared instance and the bare `axios` singleton (used internally
// for the /auth/refresh call) need their own mock adapter — they are
// separate Axios instances with independent `defaults.adapter`.
const instanceMock = new MockAdapter(axiosInstance)
const globalMock = new MockAdapter(axios)

beforeEach(() => {
  localStorage.clear()
  instanceMock.reset()
  globalMock.reset()
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('request interceptor', () => {
  it('attaches the Authorization header when a token is stored', async () => {
    localStorage.setItem('access_token', 'my-token')
    instanceMock.onGet('/products').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer my-token')
      return [200, { success: true, data: [] }]
    })

    await axiosInstance.get('/products')
  })

  it('sends no Authorization header when there is no token', async () => {
    instanceMock.onGet('/products').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined()
      return [200, { success: true, data: [] }]
    })

    await axiosInstance.get('/products')
  })
})

describe('response interceptor — 401 refresh flow', () => {
  it('passes through non-401 errors untouched', async () => {
    instanceMock.onGet('/orders').reply(500, { detail: 'Server error' })
    await expect(axiosInstance.get('/orders')).rejects.toMatchObject({
      response: { status: 500 },
    })
  })

  it('logs out immediately when there is no refresh token', async () => {
    localStorage.setItem('access_token', 'expired-token')
    instanceMock.onGet('/orders').reply(401)

    await expect(axiosInstance.get('/orders')).rejects.toBeTruthy()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(window.location.href).toBe('/auth/login')
  })

  it('refreshes the token and retries the original request on success', async () => {
    localStorage.setItem('access_token', 'expired-token')
    localStorage.setItem('refresh_token', 'valid-refresh-token')

    let ordersCallCount = 0
    instanceMock.onGet('/orders').reply((config) => {
      ordersCallCount++
      if (config.headers?.Authorization === 'Bearer new-access-token') {
        return [200, { success: true, data: [] }]
      }
      return [401]
    })
    globalMock.onPost(/\/auth\/refresh$/).reply(200, {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    })

    const response = await axiosInstance.get('/orders')

    expect(response.status).toBe(200)
    expect(ordersCallCount).toBe(2) // original 401 + retried success
    expect(localStorage.getItem('access_token')).toBe('new-access-token')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token')
  })

  it('logs out when the refresh call itself fails', async () => {
    localStorage.setItem('access_token', 'expired-token')
    localStorage.setItem('refresh_token', 'stale-refresh-token')

    instanceMock.onGet('/orders').reply(401)
    globalMock.onPost(/\/auth\/refresh$/).reply(401)

    await expect(axiosInstance.get('/orders')).rejects.toBeTruthy()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(window.location.href).toBe('/auth/login')
  })

  it('queues concurrent 401s and only calls /auth/refresh once', async () => {
    localStorage.setItem('access_token', 'expired-token')
    localStorage.setItem('refresh_token', 'valid-refresh-token')

    instanceMock.onGet('/orders').reply((config) => {
      if (config.headers?.Authorization === 'Bearer new-access-token') {
        return [200, { success: true, data: ['orders'] }]
      }
      return [401]
    })
    instanceMock.onGet('/cart').reply((config) => {
      if (config.headers?.Authorization === 'Bearer new-access-token') {
        return [200, { success: true, data: ['cart'] }]
      }
      return [401]
    })

    let refreshCallCount = 0
    globalMock.onPost(/\/auth\/refresh$/).reply(() => {
      refreshCallCount++
      return [200, { access_token: 'new-access-token', refresh_token: 'new-refresh-token' }]
    })

    const [ordersRes, cartRes] = await Promise.all([
      axiosInstance.get('/orders'),
      axiosInstance.get('/cart'),
    ])

    expect(refreshCallCount).toBe(1)
    expect(ordersRes.status).toBe(200)
    expect(cartRes.status).toBe(200)
  })
})
