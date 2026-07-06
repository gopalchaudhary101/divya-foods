import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import CountdownTimer from './CountdownTimer'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('CountdownTimer', () => {
  it('shows the remaining time formatted as HH:MM:SS', () => {
    const endsAt = new Date(Date.now() + (2 * 3_600_000 + 5 * 60_000 + 30_000)).toISOString()
    render(<CountdownTimer endsAt={endsAt} />)
    expect(screen.getByText('02:05:30')).toBeInTheDocument()
  })

  it('shows "Expired" when the end time is already in the past', () => {
    const endsAt = new Date(Date.now() - 1000).toISOString()
    render(<CountdownTimer endsAt={endsAt} />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('counts down as time passes', () => {
    const endsAt = new Date(Date.now() + 10_000).toISOString()
    render(<CountdownTimer endsAt={endsAt} />)
    expect(screen.getByText('00:00:10')).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('00:00:07')).toBeInTheDocument()
  })

  it('calls onExpire and switches to "Expired" once the countdown reaches zero', () => {
    const onExpire = vi.fn()
    const endsAt = new Date(Date.now() + 2000).toISOString()
    render(<CountdownTimer endsAt={endsAt} onExpire={onExpire} />)

    act(() => { vi.advanceTimersByTime(2100) })

    expect(onExpire).toHaveBeenCalledOnce()
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })
})
