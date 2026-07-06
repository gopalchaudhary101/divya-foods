import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, User, Phone, Fish } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ROUTES } from '@/constants/routes'

interface FormData {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  password?: string
  confirmPassword?: string
}

export default function RegisterPage() {
  const { register: registerUser, isLoading } = useAuth()
  const [form, setForm] = useState<FormData>({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(p => ({ ...p, [field]: e.target.value }))
      setErrors(p => ({ ...p, [field]: undefined }))
    }
  }

  function validate(): boolean {
    const e: FormErrors = {}
    if (!form.name.trim()) e.name = 'Name is required'
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.phone) e.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Minimum 8 characters'
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password'
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    try {
      await registerUser({
        name: form.name.trim(),
        email: form.email,
        phone: form.phone,
        password: form.password,
      })
    } catch {
      // error toast handled in useAuth
    }
  }

  return (
    <>
      <Helmet><title>Create Account — Divya Foods</title></Helmet>

      <div className="min-h-screen flex bg-premium-cream dark:bg-[#03182E]">

        {/* ── Left branding panel (desktop) ── */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-premium-navy to-[#060F16] flex-col justify-between p-12">
          <Link to={ROUTES.HOME} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Fish size={22} className="text-premium-gold" />
            </div>
            <span className="font-display text-2xl font-bold text-white">Divya Foods</span>
          </Link>

          <div>
            <h2 className="font-display text-4xl font-bold text-white leading-snug">
              Join Delhi's Premier<br />Seafood Community
            </h2>
            <p className="mt-4 text-premium-muted text-lg leading-relaxed">
              Create your account and get access to exclusive deals,<br />
              order tracking, and priority delivery.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              {[
                { label: 'Fresh Stock', desc: 'Imported daily' },
                { label: 'Fast Delivery', desc: 'Delhi NCR · NCR cities' },
                { label: 'Secure Pay', desc: 'Razorpay protected' },
                { label: 'Easy Returns', desc: 'Quality guaranteed' },
              ].map(({ label, desc }) => (
                <div key={label} className="bg-white/10 rounded-xl p-4">
                  <p className="font-semibold text-white text-sm">{label}</p>
                  <p className="text-premium-muted text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-premium-muted text-xs">
            © {new Date().getFullYear()} Divya Foods · O-52, Saurabh Vihar, New Delhi
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
              <span className="font-display text-xl font-bold text-premium-navy dark:text-white">Divya Foods</span>
            </Link>

            <h1 className="font-display text-3xl font-bold text-premium-navy dark:text-white">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-premium-navy/50">
              Join thousands of seafood lovers in Delhi NCR
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4" noValidate>
              <Input
                label="Full name"
                type="text"
                placeholder="Rahul Sharma"
                value={form.name}
                onChange={set('name')}
                error={errors.name}
                leftIcon={<User size={16} />}
                autoComplete="name"
                required
              />

              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
                leftIcon={<Mail size={16} />}
                autoComplete="email"
                required
              />

              <Input
                label="Mobile number"
                type="tel"
                placeholder="9999123456"
                value={form.phone}
                onChange={set('phone')}
                error={errors.phone}
                leftIcon={<Phone size={16} />}
                helperText="10-digit Indian mobile number"
                autoComplete="tel"
                required
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={set('password')}
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
                label="Confirm password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                error={errors.confirmPassword}
                leftIcon={<Lock size={16} />}
                autoComplete="new-password"
                required
              />

              <Button
                type="submit"
                variant="premium"
                size="lg"
                loading={isLoading}
                className="w-full mt-1"
              >
                Create Account
              </Button>

              <p className="text-center text-xs text-premium-navy/40">
                By creating an account you agree to our{' '}
                <span className="text-premium-teal">Terms of Service</span> and{' '}
                <span className="text-premium-teal">Privacy Policy</span>
              </p>
            </form>

            <p className="mt-6 text-center text-sm text-premium-navy/50">
              Already have an account?{' '}
              <Link
                to={ROUTES.AUTH.LOGIN}
                className="font-medium text-premium-teal hover:text-premium-gold transition-colors"
              >
                Sign in
              </Link>
            </p>

          </div>
        </div>

      </div>
    </>
  )
}
