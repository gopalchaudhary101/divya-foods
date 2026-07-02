/**
 * Central Axios instance used by every API function in this project.
 *
 * TWO interceptors are wired here:
 *
 * REQUEST interceptor
 *   Attaches the JWT access token to every outgoing request header.
 *   Components and hooks never need to think about this.
 *
 * RESPONSE interceptor — Refresh Token Queue
 *   When a request returns 401 (token expired):
 *     1. Pause the failed request
 *     2. Call /auth/refresh once to get a new access token
 *     3. Retry the failed request with the new token
 *
 *   The QUEUE solves a race condition: if 5 concurrent requests all
 *   receive 401 simultaneously, we must call /auth/refresh exactly ONCE
 *   and replay all 5 after. Without the queue, we'd fire 5 refresh calls
 *   and the server would invalidate tokens after the first one completes.
 *
 *   If the refresh also fails → clear tokens → redirect to /auth/login.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Refresh queue state ──────────────────────────────────────────────────────

let isRefreshing = false

interface QueueItem {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}

let failedQueue: QueueItem[] = []

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach((item) => {
    if (error) {
      item.reject(error)
    } else {
      item.resolve(token as string)
    }
  })
  failedQueue = []
}

function clearAuth(): void {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// ─── Request interceptor ──────────────────────────────────────────────────────

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response interceptor ─────────────────────────────────────────────────────

// Extend the config type to track retry attempts
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig

    // Only intercept 401 errors that haven't already been retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refresh_token')

    // No refresh token stored — force logout immediately
    if (!refreshToken) {
      clearAuth()
      window.location.href = '/auth/login'
      return Promise.reject(error)
    }

    // A refresh is already running — add this request to the queue
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((newToken) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        return axiosInstance(originalRequest)
      })
    }

    // This is the first 401 — start the refresh flow
    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post<{
        access_token: string
        refresh_token: string
      }>(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })

      const { access_token, refresh_token: newRefreshToken } = data

      localStorage.setItem('access_token', access_token)
      localStorage.setItem('refresh_token', newRefreshToken)
      axiosInstance.defaults.headers.common.Authorization = `Bearer ${access_token}`

      processQueue(null, access_token)

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access_token}`
      }

      return axiosInstance(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      clearAuth()
      window.location.href = '/auth/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default axiosInstance
