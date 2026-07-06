import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner, FullPageSpinner } from './Spinner'

describe('Spinner', () => {
  it('renders with an accessible loading role and label', () => {
    render(<Spinner />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('applies the medium size by default', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toHaveClass('w-8', 'h-8')
  })

  it('applies the requested size', () => {
    render(<Spinner size="lg" />)
    expect(screen.getByRole('status')).toHaveClass('w-12', 'h-12')
  })
})

describe('FullPageSpinner', () => {
  it('renders a large spinner with a loading message', () => {
    render(<FullPageSpinner />)
    expect(screen.getByRole('status')).toHaveClass('w-12', 'h-12')
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
})
