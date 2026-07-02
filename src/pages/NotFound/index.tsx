import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

const NotFoundPage: React.FC = () => {
  return (
    <>
      <Helmet><title>404 — Page Not Found — Divya Foods</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-ocean-50">
        <div className="text-center px-4">
          <h1 className="text-9xl font-display font-bold text-ocean-100">404</h1>
          <p className="text-2xl font-semibold text-ocean-900 mt-4">Page Not Found</p>
          <p className="text-ocean-500 mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link
            to={ROUTES.HOME}
            className="mt-8 inline-block px-8 py-3 bg-ocean-500 text-white font-semibold rounded-full hover:bg-ocean-700 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </>
  )
}

export default NotFoundPage
