import React from 'react'
import { Helmet } from 'react-helmet-async'

const ProfilePage: React.FC = () => {
  return (
    <>
      <Helmet><title>My Profile — Divya Foods</title></Helmet>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-display text-ocean-900">My Profile</h1>
          <p className="mt-2 text-ocean-500">Coming in Phase 6</p>
        </div>
      </div>
    </>
  )
}

export default ProfilePage
