import { useEffect, useState } from 'react'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { setCredentials, logout } from '@/features/auth/authSlice'
import { authApi } from '@/services/api/authApi'

interface AuthInitializerProps {
  children: React.ReactNode
}

/**
 * Runs once on mount. If an access_token exists in localStorage, calls /auth/me
 * to validate it and re-hydrate the Redux auth state.
 *
 * While this check is in-flight the app shows a full-screen spinner —
 * this prevents protected routes from flashing "unauthenticated" for a frame
 * before the response arrives.
 *
 * On success  → dispatches setCredentials (isAuthenticated = true)
 * On failure  → dispatches logout (clears stale tokens)
 * No token    → skips the API call entirely, renders immediately
 */
export function AuthInitializer({ children }: AuthInitializerProps) {
  const dispatch = useAppDispatch()
  const [isInitializing, setIsInitializing] = useState(
    () => Boolean(localStorage.getItem('access_token')) // lazy init: only block if token exists
  )

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return // no token → nothing to validate

    authApi
      .getMe()
      .then((user) => {
        dispatch(setCredentials({ user, token }))
      })
      .catch(() => {
        // Token expired / revoked — clear everything so user sees a clean login
        dispatch(logout())
      })
      .finally(() => {
        setIsInitializing(false)
      })
  }, [dispatch])

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ocean-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-ocean-200 border-t-ocean-500 rounded-full animate-spin" />
          <p className="text-ocean-200 text-sm font-medium tracking-wide">Loading Divya Luxury Seafoods…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
