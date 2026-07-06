import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>In Stock</Badge>)
    expect(screen.getByText('In Stock')).toBeInTheDocument()
  })

  it('applies the success variant classes by default when specified', () => {
    render(<Badge variant="success">Active</Badge>)
    expect(screen.getByText('Active')).toHaveClass('bg-premium-teal/15')
  })

  it('applies the default variant classes when none is given', () => {
    render(<Badge>Default</Badge>)
    expect(screen.getByText('Default')).toHaveClass('bg-premium-navy/10')
  })
})
