import React from 'react'
import { Helmet } from 'react-helmet-async'

const LoginPage: React.FC = () => {
  return (
    <>
      <Helmet><title>Login — Divya Foods</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-ocean-50">
        <div className="text-center">
          <h1 className="text-3xl font-display text-ocean-900">Login</h1>
          <p className="mt-2 text-ocean-500">Coming in Phase 6 — Authentication</p>
        </div>
      </div>
    </>
  )
}

export default LoginPage
