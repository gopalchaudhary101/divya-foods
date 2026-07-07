import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Mail, Fish, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '@/services/api/authApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getErrorMessage } from '@/utils/apiError'
import { ROUTES } from '@/constants/routes'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('Email is required'); return }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email'); return }

    setIsLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Helmet><title>Forgot Password — Divya Luxury Seafoods</title></Helmet>

      <div className="min-h-screen flex bg-premium-cream dark:bg-[#03182E]">
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-premium-navy to-[#060F16] flex-col justify-between p-12">
          <Link to={ROUTES.HOME} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Fish size={22} className="text-premium-gold" />
            </div>
            <span className="font-display text-2xl font-bold text-white">Divya Luxury Seafoods</span>
          </Link>

          <div>
            <h2 className="font-display text-4xl font-bold text-white leading-snug">
              Forgot your<br />password?
            </h2>
            <p className="mt-4 text-premium-muted text-lg leading-relaxed">
              No worries — we'll email you a link to reset it.
            </p>
          </div>

          <p className="text-premium-muted text-xs">
            © {new Date().getFullYear()} Divya Luxury Seafoods · O-52, Saurabh Vihar, New Delhi
          </p>
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <Link to={ROUTES.HOME} className="flex lg:hidden items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-premium-navy rounded-xl flex items-center justify-center">
                <Fish size={18} className="text-premium-gold" />
              </div>
              <span className="font-display text-xl font-bold text-premium-navy dark:text-white">Divya Luxury Seafoods</span>
            </Link>

            {sent ? (
              <div className="text-center py-8">
                <CheckCircle size={48} className="mx-auto text-premium-teal mb-4" />
                <h1 className="font-display text-2xl font-bold text-premium-navy dark:text-white mb-2">Check your email</h1>
                <p className="text-sm text-premium-navy/50 mb-8">
                  If an account exists for <strong className="text-premium-navy dark:text-ocean-100">{email}</strong>, we've sent a link to reset your password.
                </p>
                <Link to={ROUTES.AUTH.LOGIN} className="text-sm font-medium text-premium-teal hover:text-premium-gold transition-colors">
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <h1 className="font-display text-3xl font-bold text-premium-navy dark:text-white">
                  Reset your password
                </h1>
                <p className="mt-1.5 text-sm text-premium-navy/50">
                  Enter the email address on your account and we'll send you a reset link.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(undefined) }}
                    error={error}
                    leftIcon={<Mail size={16} />}
                    autoComplete="email"
                    required
                  />

                  <Button type="submit" variant="premium" size="lg" loading={isLoading} className="w-full">
                    Send Reset Link
                  </Button>
                </form>

                <p className="mt-6 text-center text-sm text-premium-navy/50">
                  Remembered your password?{' '}
                  <Link to={ROUTES.AUTH.LOGIN} className="font-medium text-premium-teal hover:text-premium-gold transition-colors">
                    Sign in
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
