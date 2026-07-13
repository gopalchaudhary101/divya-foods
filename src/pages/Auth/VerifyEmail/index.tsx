import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Fish, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { authApi } from '@/services/api/authApi'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/utils/apiError'
import { ROUTES } from '@/constants/routes'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    authApi.verifyEmail(token)
      .then(() => { if (!cancelled) setStatus('success') })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(err))
          setStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [token])

  return (
    <>
      <Helmet><title>Verify Email — Divya Foods</title></Helmet>

      <div className="min-h-screen flex items-center justify-center bg-premium-cream dark:bg-[#03182E] px-4">
        <div className="w-full max-w-md text-center">
          <Link to={ROUTES.HOME} className="inline-flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-premium-navy rounded-xl flex items-center justify-center">
              <Fish size={18} className="text-premium-gold" />
            </div>
            <span className="font-display text-xl font-bold text-premium-navy dark:text-white">Divya Foods</span>
          </Link>

          {status === 'verifying' && (
            <div className="py-8">
              <Loader2 size={48} className="mx-auto text-premium-teal mb-4 animate-spin" />
              <h1 className="font-display text-2xl font-bold text-premium-navy dark:text-white mb-2">Verifying your email…</h1>
            </div>
          )}

          {status === 'success' && (
            <div className="py-8">
              <CheckCircle size={48} className="mx-auto text-premium-teal mb-4" />
              <h1 className="font-display text-2xl font-bold text-premium-navy dark:text-white mb-2">Email verified</h1>
              <p className="text-sm text-premium-navy/50 dark:text-ocean-50/50 mb-8">
                Thanks — your email is confirmed. You're all set.
              </p>
              <Button variant="premium" size="lg" onClick={() => navigate(ROUTES.HOME)}>
                Continue Shopping
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-8">
              <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
              <h1 className="font-display text-2xl font-bold text-premium-navy dark:text-white mb-2">
                {token ? 'Link invalid or expired' : 'Invalid verification link'}
              </h1>
              <p className="text-sm text-premium-navy/50 dark:text-ocean-50/50 mb-8">
                {token
                  ? errorMessage || 'This verification link is invalid or has expired.'
                  : 'This verification link is missing or malformed.'}
                {' '}You can still shop and order normally — verifying just helps order emails reach you.
              </p>
              <Button variant="premium" size="lg" onClick={() => navigate(ROUTES.HOME)}>
                Continue Shopping
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
