import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('Boom')
}

describe('ErrorBoundary', () => {
  const originalError = console.error
  afterEach(() => {
    console.error = originalError
    vi.restoreAllMocks()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows the recovery screen instead of crashing the whole tree when a child throws', () => {
    console.error = vi.fn() // React logs the error to console too — silence it for this test
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument()
  })

  it('reloads the page when "Reload page" is clicked', () => {
    console.error = vi.fn()
    const reloadSpy = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    })

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByRole('button', { name: /reload page/i }))
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })
})
