import type { AxiosError } from 'axios'
import type { ApiError } from '@/types'

/**
 * Extracts a human-readable error message from any error thrown by Axios.
 * FastAPI returns: { "detail": "string" } or { "message": "string" }
 *
 * Usage:
 *   catch (err) { toast.error(getErrorMessage(err)) }
 */
export function getErrorMessage(error: unknown): string {
  const axiosErr = error as AxiosError<ApiError & { detail?: string }>
  if (axiosErr?.response?.data) {
    const data = axiosErr.response.data
    // FastAPI validation errors use "detail"
    if (typeof data.detail === 'string') return data.detail
    // Our custom API errors use "message"
    if (data.message) return data.message
  }
  if (axiosErr?.message) return axiosErr.message
  return 'Something went wrong. Please try again.'
}

/**
 * Returns true if the Axios error has a specific HTTP status code.
 * Usage: if (isAxiosError(err, 404)) { show404() }
 */
export function isAxiosError(error: unknown, status?: number): boolean {
  const axiosErr = error as AxiosError
  if (!axiosErr?.isAxiosError) return false
  if (status !== undefined) return axiosErr.response?.status === status
  return true
}
