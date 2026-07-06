import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/testUtils'
import NotFoundPage from './index'

describe('NotFoundPage', () => {
  it('renders a 404 message with a link back home', () => {
    renderWithProviders(<NotFoundPage />)
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Page Not Found')).toBeInTheDocument()
    expect(screen.getByText('Back to Home')).toHaveAttribute('href', '/')
  })
})
