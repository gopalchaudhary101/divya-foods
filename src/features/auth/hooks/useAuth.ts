import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { setCredentials, setLoading, logout as logoutAction } from '@/features/auth/authSlice'
import { authApi, type LoginRequest, type RegisterRequest } from '@/services/api/authApi'
import { getErrorMessage } from '@/utils/apiError'
import { ROUTES } from '@/constants/routes'

/**
 * Central auth hook — provides all authentication operations.
 *
 * Usage in any component:
 *   const { user, isAuthenticated, login, logout, register } = useAuth()
 *
 * Do NOT duplicate auth logic in components. Always go through this hook.
 */
export function useAuth() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, token } = useAppSelector((s) => s.auth)

  const login = useCallback(
    async (credentials: LoginRequest): Promise<void> => {
      try {
        dispatch(setLoading(true))
        const response = await authApi.login(credentials)
        dispatch(setCredentials({ user: response.user, token: response.access_token }))
        localStorage.setItem('refresh_token', response.refresh_token)
        toast.success(`Welcome back, ${response.user.name}!`)
        navigate(response.user.role === 'driver' ? ROUTES.DRIVER : ROUTES.HOME)
      } catch (err) {
        toast.error(getErrorMessage(err))
        throw err // re-throw so the form's isSubmitting state clears
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch, navigate]
  )

  const register = useCallback(
    async (payload: RegisterRequest): Promise<void> => {
      try {
        dispatch(setLoading(true))
        const response = await authApi.register(payload)
        dispatch(setCredentials({ user: response.user, token: response.access_token }))
        localStorage.setItem('refresh_token', response.refresh_token)
        toast.success(`Welcome to Divya Luxury Seafoods, ${response.user.name}!`)
        navigate(ROUTES.HOME)
      } catch (err) {
        toast.error(getErrorMessage(err))
        throw err
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch, navigate]
  )

  const logout = useCallback(async (): Promise<void> => {
    // Best-effort server logout — don't block UI if it fails
    authApi.logout().catch(() => {})
    dispatch(logoutAction())
    navigate(ROUTES.AUTH.LOGIN)
    toast.success('Logged out successfully')
  }, [dispatch, navigate])

  const isAdmin  = user?.role === 'admin'
  const isDriver = user?.role === 'driver'

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    isAdmin,
    isDriver,
    login,
    register,
    logout,
  }
}
