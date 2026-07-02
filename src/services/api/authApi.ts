import axiosInstance from './axiosInstance'
import type { User, ApiResponse } from '@/types'

// ─── Request types ────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  phone: string
  password: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

// ─── API functions ────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Login with email + password.
   * Returns JWT tokens + user object.
   */
  login: async (credentials: LoginRequest): Promise<AuthTokens> => {
    const { data } = await axiosInstance.post<AuthTokens>('/auth/login', credentials)
    return data
  },

  /**
   * Create a new customer account.
   */
  register: async (payload: RegisterRequest): Promise<AuthTokens> => {
    const { data } = await axiosInstance.post<AuthTokens>('/auth/register', payload)
    return data
  },

  /**
   * Invalidate the refresh token on the server (best-effort — no retry on failure).
   */
  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout')
  },

  /**
   * Fetch the currently authenticated user's profile.
   * Called on app startup to re-hydrate auth state from a stored token.
   */
  getMe: async (): Promise<User> => {
    const { data } = await axiosInstance.get<ApiResponse<User>>('/auth/me')
    return data.data
  },

  /**
   * Send a password-reset email to the given address.
   */
  forgotPassword: async (email: string): Promise<void> => {
    await axiosInstance.post('/auth/forgot-password', { email })
  },

  /**
   * Reset password using the token from the reset email.
   */
  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await axiosInstance.post('/auth/reset-password', { token, new_password: newPassword })
  },
}
