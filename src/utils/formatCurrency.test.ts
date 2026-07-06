import { describe, it, expect } from 'vitest'
import { formatCurrency } from './formatCurrency'

describe('formatCurrency', () => {
  it('formats a whole number as INR with no decimals', () => {
    expect(formatCurrency(999)).toBe('₹999')
  })

  it('formats large numbers with Indian digit grouping', () => {
    expect(formatCurrency(123456)).toBe('₹1,23,456')
  })

  it('rounds off fractional amounts', () => {
    expect(formatCurrency(99.6)).toBe('₹100')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('₹0')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-500)).toBe('-₹500')
  })
})
