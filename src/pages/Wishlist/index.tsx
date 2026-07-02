import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, ShoppingCart, ChevronRight, LogIn } from 'lucide-react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useWishlistQuery } from '@/hooks/useWishlist'
import { addToCart } from '@/features/cart/cartSlice'
import { ProductCard } from '@/components/shared/ProductCard'
import { Button } from '@/components/ui/Button'
import type { Product } from '@/types'
import { ROUTES } from '@/constants/routes'

function WishlistSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-ocean-100 dark:border-ocean-800 animate-pulse">
          <div className="aspect-square bg-ocean-100 dark:bg-ocean-800" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-ocean-100 dark:bg-ocean-800 rounded w-3/4" />
            <div className="h-3 bg-ocean-100 dark:bg-ocean-800 rounded w-1/2" />
            <div className="h-8 bg-ocean-100 dark:bg-ocean-800 rounded-xl mt-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function WishlistPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const localProductIds = useAppSelector((s) => s.wishlist.productIds)
  const { data: products, isLoading } = useWishlistQuery()

  function handleAddToCart(product: Product) {
    dispatch(addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.images[0] ?? null,
      maxQuantity: product.stockQuantity ?? 10,
    }))
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <>
        <Helmet><title>Wishlist — Divya Foods</title></Helmet>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="relative inline-block mb-6">
            <Heart size={64} className="text-red-200" />
            {localProductIds.length > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {localProductIds.length}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white mb-2">
            Your Wishlist
          </h1>
          {localProductIds.length > 0 ? (
            <p className="text-ocean-400 mb-8 max-w-sm mx-auto">
              You have <strong>{localProductIds.length}</strong> saved item{localProductIds.length !== 1 ? 's' : ''}.
              Sign in to see your wishlist and save it across devices.
            </p>
          ) : (
            <p className="text-ocean-400 mb-8 max-w-sm mx-auto">
              Sign in to save products you love and access your wishlist on any device.
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate(ROUTES.AUTH.LOGIN)}
              variant="primary"
              size="lg"
              leftIcon={<LogIn size={18} />}
            >
              Sign In
            </Button>
            <Button
              onClick={() => navigate(ROUTES.PRODUCTS)}
              variant="outline"
              size="lg"
            >
              Browse Products
            </Button>
          </div>
        </div>
      </>
    )
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <Helmet><title>Wishlist — Divya Foods</title></Helmet>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-8 w-40 bg-ocean-100 dark:bg-ocean-800 rounded animate-pulse mb-8" />
          <WishlistSkeleton />
        </div>
      </>
    )
  }

  const wishlistItems = products ?? []

  // ── Empty state ────────────────────────────────────────────────────────────
  if (wishlistItems.length === 0) {
    return (
      <>
        <Helmet><title>Wishlist — Divya Foods</title></Helmet>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <Heart size={64} className="mx-auto text-ocean-200 dark:text-ocean-700 mb-6" />
          <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white mb-2">
            Your wishlist is empty
          </h1>
          <p className="text-ocean-400 mb-8 max-w-sm mx-auto">
            Save products you love by tapping the heart icon on any product card.
          </p>
          <Button
            onClick={() => navigate(ROUTES.PRODUCTS)}
            variant="primary"
            size="lg"
            leftIcon={<Heart size={18} />}
          >
            Discover Products
          </Button>
        </div>
      </>
    )
  }

  // ── Wishlist grid ──────────────────────────────────────────────────────────
  return (
    <>
      <Helmet><title>Wishlist ({wishlistItems.length} items) — Divya Foods</title></Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-ocean-400 mb-6">
          <Link to={ROUTES.HOME} className="hover:text-ocean-700 transition-colors">Home</Link>
          <ChevronRight size={13} />
          <span className="text-ocean-700 dark:text-ocean-200 font-medium">Wishlist</span>
        </nav>

        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white">
            My Wishlist
            <span className="ml-3 text-lg font-normal text-ocean-400">
              ({wishlistItems.length} items)
            </span>
          </h1>
          <Button
            onClick={() => navigate(ROUTES.PRODUCTS)}
            variant="outline"
            size="sm"
          >
            Continue Shopping
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {wishlistItems.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      </div>
    </>
  )
}
