import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StarRating } from './StarRating'

describe('StarRating', () => {
  it('renders 5 stars', () => {
    const { container } = render(<StarRating rating={3} />)
    expect(container.querySelectorAll('svg')).toHaveLength(5)
  })

  it('fills the correct number of stars for a whole rating', () => {
    const { container } = render(<StarRating rating={3} />)
    const filled = container.querySelectorAll('.fill-premium-gold')
    expect(filled).toHaveLength(3)
  })

  it('shows the review count by default', () => {
    render(<StarRating rating={4.5} count={128} />)
    expect(screen.getByText('(128)')).toBeInTheDocument()
  })

  it('hides the count when showCount is false', () => {
    render(<StarRating rating={4.5} count={128} showCount={false} />)
    expect(screen.queryByText('(128)')).not.toBeInTheDocument()
  })

  it('hides the count when no count is given, even if showCount is true', () => {
    render(<StarRating rating={4.5} />)
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
  })
})
