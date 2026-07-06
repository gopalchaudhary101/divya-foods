import { describe, it, expect } from 'vitest'
import { getErrorMessage, isAxiosError } from './apiError'

function makeAxiosError(overrides: Record<string, unknown> = {}) {
  return {
    isAxiosError: true,
    message: 'Request failed',
    response: undefined,
    ...overrides,
  }
}

describe('getErrorMessage', () => {
  it('extracts FastAPI "detail" string from the response', () => {
    const err = makeAxiosError({ response: { status: 422, data: { detail: 'Invalid email format.' } } })
    expect(getErrorMessage(err)).toBe('Invalid email format.')
  })

  it('extracts custom "message" field when no detail is present', () => {
    const err = makeAxiosError({ response: { status: 400, data: { message: 'Out of stock.' } } })
    expect(getErrorMessage(err)).toBe('Out of stock.')
  })

  it('falls back to the raw axios error message when there is no response data', () => {
    const err = makeAxiosError({ message: 'Network Error' })
    expect(getErrorMessage(err)).toBe('Network Error')
  })

  it('falls back to a generic message for a completely unknown error shape', () => {
    expect(getErrorMessage({})).toBe('Something went wrong. Please try again.')
    expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.')
  })

  it('prefers "detail" over "message" when both are present', () => {
    const err = makeAxiosError({ response: { data: { detail: 'Detail wins', message: 'Message loses' } } })
    expect(getErrorMessage(err)).toBe('Detail wins')
  })
})

describe('isAxiosError', () => {
  it('returns false for a non-axios error', () => {
    expect(isAxiosError(new Error('plain error'))).toBe(false)
  })

  it('returns true for any axios error when no status is given', () => {
    expect(isAxiosError(makeAxiosError())).toBe(true)
  })

  it('matches a specific status code', () => {
    const err = makeAxiosError({ response: { status: 404 } })
    expect(isAxiosError(err, 404)).toBe(true)
    expect(isAxiosError(err, 500)).toBe(false)
  })
})
