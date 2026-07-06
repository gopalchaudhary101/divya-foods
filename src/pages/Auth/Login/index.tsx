import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Fish } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/constants/routes'

export default function LoginPage() {
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const e: { email?: string; password?: string } = {}
    if (!email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 6) e.password = 'Minimum 6 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      await login({ email, password })
    } catch {
      // error toast handled in useAuth
    }
  }

  return (
    <>
      <Helmet><title>Login — Divya Luxury Seafoods</title></Helmet>

      <div className="min-h-screen flex bg-premium-cream dark:bg-[#03182E]">

        {/* ── Left branding panel (desktop) ── */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-premium-navy to-[#060F16] flex-col justify-between p-12">
          <Link to={ROUTES.HOME} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Fish size={22} className="text-premium-gold" />
            </div>
            <span className="font-display text-2xl font-bold text-white">Divya Luxury Seafoods</span>
          </Link>

          <div>
            <h2 className="font-display text-4xl font-bold text-white leading-snug">
              Premium Seafood<br />Delivered Fresh
            </h2>
            <p className="mt-4 text-premium-muted text-lg leading-relaxed">
              Delhi NCR's finest imported seafood — sourced globally,<br />
              delivered to your doorstep.
            </p>
            <div className="mt-10 flex flex-col gap-3">
              {['Salmon · Tuna · Prawns · Lobster', 'Same-day delivery in Delhi NCR', 'Hygienically packed & chilled'].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-premium-teal shrink-0" />
                  <span className="text-premium-cream/90 text-sm">{t}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-premium-muted text-xs">
            © {new Date().getFullYear()} Divya Luxury Seafoods · O-52, Saurabh Vihar, New Delhi
          </p>
        </div>

        {/* ── Right form panel ── */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">

            {/* Mobile logo */}
            <Link to={ROUTES.HOME} className="flex lg:hidden items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-premium-navy rounded-xl flex items-center justify-center">
                <Fish size={18} className="text-premium-gold" />
              </div>
              <span className="font-display text-xl font-bold text-premium-navy dark:text-white">Divya Luxury Seafoods</span>
            </Link>

            <h1 className="font-display text-3xl font-bold text-premium-navy dark:text-white">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-premium-navy/50">
              Sign in to your account to continue
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
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

              <div className="flex items-center justify-between">
                <span />
                <Link
                  to={ROUTES.AUTH.FORGOT_PASSWORD}
                  className="text-xs text-premium-teal hover:text-premium-gold transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="premium"
                size="lg"
                loading={isLoading}
                className="w-full"
              >
                Sign In
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-premium-navy/50">
              Don't have an account?{' '}
              <Link
                to={ROUTES.AUTH.REGISTER}
                className="font-medium text-premium-teal hover:text-premium-gold transition-colors"
              >
                Create one free
              </Link>
            </p>

          </div>
        </div>

      </div>
    </>
  )
}
