import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/testUtils'
import { RequireRole } from './RequireRole'

const driverState = {
  auth: {
    user: { id: 'u1', name: 'Ravi', email: 'ravi@test.com', role: 'driver' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

const customerState = {
  auth: {
    user: { id: 'u2', name: 'Priya', email: 'priya@test.com', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
}

describe('RequireRole', () => {
  it('renders children when the user has an allowed role', () => {
    renderWithProviders(
      <RequireRole roles={['driver']}><p>Driver Content</p></RequireRole>,
      { preloadedState: driverState },
    )
    expect(screen.getByText('Driver Content')).toBeInTheDocument()
  })

  it('does not render children for a logged-in user with the wrong role', () => {
    renderWithProviders(
      <RequireRole roles={['driver']}><p>Driver Content</p></RequireRole>,
      { preloadedState: customerState },
    )
    expect(screen.queryByText('Driver Content')).not.toBeInTheDocument()
  })

  it('does not render children for an unauthenticated visitor', () => {
    renderWithProviders(<RequireRole roles={['driver']}><p>Driver Content</p></RequireRole>)
    expect(screen.queryByText('Driver Content')).not.toBeInTheDocument()
  })
})
