import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, ChevronRight } from 'lucide-react'
import axiosInstance from '@/services/api/axiosInstance'
import type { ApiResponse } from '@/types'
import { BundleCard, type Bundle } from '@/components/shared/BundleCard'
import { ROUTES } from '@/constants/routes'

function BundleSkeleton() {
  return (
    <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl overflow-hidden animate-pulse">
      <div className="h-40 bg-premium-navy/10 dark:bg-ocean-800" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-premium-navy/10 dark:bg-ocean-800 rounded w-3/4" />
        <div className="h-3 bg-premium-navy/10 dark:bg-ocean-800 rounded w-full" />
        <div className="h-3 bg-premium-navy/10 dark:bg-ocean-800 rounded w-1/2" />
        <div className="h-8 bg-premium-navy/10 dark:bg-ocean-800 rounded-xl mt-4" />
      </div>
    </div>
  )
}

export default function BundlesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['bundles'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ApiResponse<Bundle[]>>('/bundles')
      return data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const bundles = data ?? []

  return (
    <>
      <Helmet><title>Bundle Deals — Divya Foods</title></Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-premium-navy/40 mb-6">
          <Link to={ROUTES.HOME} className="hover:text-premium-gold transition-colors">Home</Link>
          <ChevronRight size={13} />
          <span className="text-premium-navy dark:text-ocean-200 font-medium">Bundle Deals</span>
        </nav>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-premium-navy dark:text-white">Bundle Deals</h1>
          <p className="text-premium-navy/40 mt-1">Curated combos at a special price — more flavour, more savings.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <BundleSkeleton key={i} />)}
          </div>
        ) : bundles.length === 0 ? (
          <div className="py-24 text-center">
            <Package size={56} className="mx-auto text-premium-navy/20 dark:text-ocean-700 mb-5" />
            <h2 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-2">No bundles yet</h2>
            <p className="text-premium-navy/40 mb-6">Check back soon — we're curating deals for you.</p>
            <Link
              to={ROUTES.PRODUCTS}
              className="inline-flex items-center gap-2 bg-premium-gold hover:bg-premium-gold-light text-premium-navy px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map(bundle => <BundleCard key={bundle.id} bundle={bundle} />)}
          </div>
        )}
      </div>
    </>
  )
}
