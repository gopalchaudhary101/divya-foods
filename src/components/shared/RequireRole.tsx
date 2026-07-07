import { useEffect, useMemo, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppSelector } from '@/hooks/useAppSelector'
import { ROUTES } from '@/constants/routes'
import type { User } from '@/types'

/**
 * Wraps a route that only specific roles may view: an unauthenticated visitor
 * is sent to login, and a logged-in user with the wrong role is sent home
 * with an error toast instead of seeing the page shell at all. This is a
 * frontend convenience only — the real enforcement is server-side (every
 * /admin/* endpoint requires the same roles via the require_admin dependency).
 */
export function RequireRole({ roles, children }: { roles: User['role'][]; children: React.ReactNode }) {
  const location = useLocation()
  const { user, isAuthenticated } = useAppSelector((s) => s.auth)
  const deniedToastShown = useRef(false)

  // Navigate re-fires its effect whenever `state` changes identity — a literal object
  // here would be a new reference every render, and since Navigate's own redirect
  // changes the location (re-running useLocation above), that becomes an infinite loop.
  const fromState = useMemo(() => ({ from: location.pathname }), [location.pathname])

  const denied = isAuthenticated && (!user || !roles.includes(user.role))

  useEffect(() => {
    if (denied && !deniedToastShown.current) {
      deniedToastShown.current = true
      toast.error("You don't have access to that page.")
    }
  }, [denied])

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.AUTH.LOGIN} state={fromState} replace />
  }
  if (denied) {
    return <Navigate to={ROUTES.HOME} replace />
  }
  return <>{children}</>
}
