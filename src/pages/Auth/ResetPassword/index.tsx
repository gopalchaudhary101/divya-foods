import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, Fish, CheckCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/services/api/authApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getErrorMessage } from '@/utils/apiError'
import { ROUTES } from '@/constants/routes'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)

  function validate() {
    const e: typeof errors = {}
    if (!password) e.password = 'Password is required'
    else if (password.length < 8) e.password = 'Minimum 8 characters'
    if (confirmPassword !== password) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !token) return

    setIsLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const invalidLink = !token

  return (
    <>
      <Helmet><title>Reset Password — Divya Foods</title></Helmet>

      <div className="min-h-screen flex bg-premium-cream dark:bg-[#03182E]">
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-premium-navy to-[#060F16] flex-col justify-between p-12">
          <Link to={ROUTES.HOME} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Fish size={22} className="text-premium-gold" />
            </div>
            <span className="font-display text-2xl font-bold text-white">Divya Foods</span>
          </Link>

          <div>
            <h2 className="font-display text-4xl font-bold text-white leading-snug">
              Choose a new<br />password
            </h2>
            <p className="mt-4 text-premium-muted text-lg leading-relaxed">
              Make it strong — at least 8 characters.
            </p>
          </div>

          <p className="text-premium-muted text-xs">
            © {new Date().getFullYear()} Divya Foods · O-52, Saurabh Vihar, New Delhi
          </p>
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <Link to={ROUTES.HOME} className="flex lg:hidden items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-premium-navy rounded-xl flex items-center justify-center">
                <Fish size={18} className="text-premium-gold" />
              </div>
              <span className="font-display text-xl font-bold text-premium-navy dark:text-white">Divya Foods</span>
            </Link>

            {invalidLink ? (
              <div className="text-center py-8">
                <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                <h1 className="font-display text-2xl font-bold text-premium-navy dark:text-white mb-2">Invalid reset link</h1>
                <p className="text-sm text-premium-navy/50 mb-8">
                  This password reset link is missing or malformed. Request a new one below.
                </p>
                <Link
                  to={ROUTES.AUTH.FORGOT_PASSWORD}
                  className="inline-block bg-premium-navy hover:bg-premium-navy/90 text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
                >
                  Request New Link
                </Link>
              </div>
            ) : done ? (
              <div className="text-center py-8">
                <CheckCircle size={48} className="mx-auto text-premium-teal mb-4" />
                <h1 className="font-display text-2xl font-bold text-premium-navy dark:text-white mb-2">Password updated</h1>
                <p className="text-sm text-premium-navy/50 mb-8">
                  Your password has been reset successfully. You can now sign in with your new password.
                </p>
                <Button variant="premium" size="lg" onClick={() => navigate(ROUTES.AUTH.LOGIN)}>
                  Go to Sign In
                </Button>
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl font-bold text-premium-navy dark:text-white">
                  Set a new password
                </h1>
                <p className="mt-1.5 text-sm text-premium-navy/50">
                  Choose a strong password you haven't used before.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
                  <Input
                    label="New password"
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
                    autoComplete="new-password"
                    required
                  />

                  <Input
                    label="Confirm new password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: undefined })) }}
                    error={errors.confirmPassword}
                    leftIcon={<Lock size={16} />}
                    autoComplete="new-password"
                    required
                  />

                  <Button type="submit" variant="premium" size="lg" loading={isLoading} className="w-full">
                    Reset Password
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-premium-navy/50">
                  <Link to={ROUTES.AUTH.LOGIN} className="font-medium text-premium-teal hover:text-premium-gold transition-colors">
                    Back to Sign In
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
