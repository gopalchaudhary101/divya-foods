import { describe, it, expect } from 'vitest'
import { formatDate } from './formatDate'

describe('formatDate', () => {
  it('formats an ISO date string as "D MMM YYYY"', () => {
    expect(formatDate('2026-03-15T10:30:00Z')).toBe('15 Mar 2026')
  })

  it('returns an empty string for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('')
  })

  it('returns an empty string for an empty input', () => {
    expect(formatDate('')).toBe('')
  })
})
