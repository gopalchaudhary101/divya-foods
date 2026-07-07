import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { authApi } from '@/services/api/authApi'
import { setCredentials } from '@/features/auth/authSlice'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { getErrorMessage } from '@/utils/apiError'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/constants/routes'

/**
 * Separate login entry point for admin/developer accounts — intentionally not
 * linked from the public navbar. Uses the same /auth/login endpoint as the
 * customer login page, but only persists a session if the account's role is
 * admin or developer; any other role is rejected here rather than logging
 * them in as a customer through the staff door.
 */
export default function AdminLoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: { email?: string; password?: string } = {}
    if (!email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const response = await authApi.login({ email, password })

      if (response.user.role !== 'admin' && response.user.role !== 'developer') {
        toast.error('This login is for admin/developer accounts only.')
        return
      }

      dispatch(setCredentials({ user: response.user, token: response.access_token }))
      localStorage.setItem('refresh_token', response.refresh_token)
      toast.success(`Welcome back, ${response.user.name}`)
      navigate(ROUTES.ADMIN.DASHBOARD)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Helmet><title>Admin Login — Divya Luxury Seafoods</title></Helmet>

      <div className="min-h-screen flex items-center justify-center bg-premium-navy px-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-3">
              <ShieldCheck size={24} className="text-premium-gold" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Staff Login</h1>
            <p className="mt-1 text-sm text-white/50">Admin &amp; developer access only</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 bg-white dark:bg-ocean-950 rounded-2xl p-6 sm:p-8 shadow-premium" noValidate>
            <Input
              label="Email address"
              type="email"
              placeholder="you@divyafoods.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
              error={errors.email}
              leftIcon={<Mail size={16} />}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
              error={errors.password}
              leftIcon={<Lock size={16} />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-premium-navy/40 hover:text-premium-gold transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              autoComplete="current-password"
              required
            />

            <Button type="submit" variant="premium" size="lg" loading={isSubmitting} className="w-full">
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-white/30">
            Not a staff member? <Link to={ROUTES.AUTH.LOGIN} className="underline hover:text-white/60">Go to customer login</Link>
          </p>
        </div>
      </div>
    </>
  )
}
