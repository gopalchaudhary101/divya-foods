import axiosInstance from './axiosInstance'
import type { User } from '@/types'

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

// The backend's UserResponse model — a raw, unwrapped object with snake_case
// timestamps (see backend/app/models/user.py). Normalized into `User` below.
interface RawUserResponse extends Omit<User, 'createdAt'> {
  created_at: string
}

interface RawAuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  user: RawUserResponse
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

function normalizeUser(raw: RawUserResponse): User {
  const { created_at, ...rest } = raw
  return { ...rest, createdAt: created_at }
}

// ─── API functions ────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Login with email + password.
   * Returns JWT tokens + user object.
   */
  login: async (credentials: LoginRequest): Promise<AuthTokens> => {
    const { data } = await axiosInstance.post<RawAuthTokens>('/auth/login', credentials)
    return { ...data, user: normalizeUser(data.user) }
  },

  /**
   * Create a new customer account.
   */
  register: async (payload: RegisterRequest): Promise<AuthTokens> => {
    const { data } = await axiosInstance.post<RawAuthTokens>('/auth/register', payload)
    return { ...data, user: normalizeUser(data.user) }
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
   *
   * The endpoint returns the user object directly (not wrapped in an
   * {success, data} envelope) — unlike most other admin/list endpoints.
   */
  getMe: async (): Promise<User> => {
    const { data } = await axiosInstance.get<RawUserResponse>('/auth/me')
    return normalizeUser(data)
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
