import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import OceanBackground from '@/components/shared/OceanBackground'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'

const HomePage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>{CONFIG.APP_NAME} — {CONFIG.TAGLINE}</title>
        <meta name="description" content={CONFIG.TAGLINE} />
      </Helmet>

      <div className="min-h-screen relative">
        <OceanBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white px-4">
          <p className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-4">
            New Delhi's Premium Import Store
          </p>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-center leading-tight">
            Divya Foods
          </h1>
          <p className="mt-4 text-xl text-ocean-100 text-center max-w-2xl">
            {CONFIG.TAGLINE}
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link
              to={ROUTES.PRODUCTS}
              className="px-8 py-3 bg-gold-500 text-ocean-900 font-semibold rounded-full hover:bg-gold-400 transition-colors"
            >
              Shop Now
            </Link>
            <Link
              to={ROUTES.PRODUCTS}
              className="px-8 py-3 border border-white/50 text-white rounded-full hover:bg-white/10 transition-colors"
            >
              Explore Categories
            </Link>
          </div>
          <div className="mt-20 text-center text-ocean-300 text-sm">
            <p>Delivering across {CONFIG.DELIVERY.AREAS.join(' · ')}</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default HomePage
