import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

const NotFoundPage: React.FC = () => {
  return (
    <>
      <Helmet><title>404 — Page Not Found — Divya Foods</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-premium-cream">
        <div className="text-center px-4">
          <h1 className="text-9xl font-display font-bold text-premium-navy/10">404</h1>
          <p className="text-2xl font-semibold text-premium-navy mt-4">Page Not Found</p>
          <p className="text-premium-navy/50 mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link
            to={ROUTES.HOME}
            className="mt-8 inline-block px-8 py-3 bg-premium-gold text-premium-navy font-semibold rounded-full hover:bg-premium-gold-light transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </>
  )
}

export default NotFoundPage
