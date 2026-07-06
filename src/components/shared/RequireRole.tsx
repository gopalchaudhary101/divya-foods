import { useMemo } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '@/hooks/useAppSelector'
import { ROUTES } from '@/constants/routes'
import type { User } from '@/types'

/**
 * Wraps a route that only specific roles may view. Unlike the admin pages
 * (which rely on API calls 403ing and the nav link just being hidden — see
 * useAuth's isAdmin), the driver dashboard gets a real guard: an
 * unauthenticated visitor is sent to login, and a logged-in user with the
 * wrong role is sent home instead of seeing the page shell at all.
 */
export function RequireRole({ roles, children }: { roles: User['role'][]; children: React.ReactNode }) {
  const location = useLocation()
  const { user, isAuthenticated } = useAppSelector((s) => s.auth)

  // Navigate re-fires its effect whenever `state` changes identity — a literal object
  // here would be a new reference every render, and since Navigate's own redirect
  // changes the location (re-running useLocation above), that becomes an infinite loop.
  const fromState = useMemo(() => ({ from: location.pathname }), [location.pathname])

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN} state={fromState} replace />
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={ROUTES.HOME} replace />
  }
  return <>{children}</>
}
