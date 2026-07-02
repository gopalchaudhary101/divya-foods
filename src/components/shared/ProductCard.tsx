import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Product } from '@/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/shared/StarRating'
import { useIsWishlisted, useToggleWishlist } from '@/hooks/useWishlist'

interface ProductCardProps {
  product: Product
  onAddToCart?: (product: Product) => void
}

// Blur-up image: renders a low-opacity skeleton then fades to full opacity on load.
// Falls back to Package icon if the URL fails (broken/404).
function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-ocean-50 dark:bg-ocean-800">
        <Package className="text-ocean-200 dark:text-ocean-600" size={48} />
      </div>
    )
  }

  return (
    <>
      {/* Skeleton shown while image is loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-ocean-100 dark:bg-ocean-800 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={[
          'w-full h-full object-cover transition-all duration-500 group-hover:scale-110',
          loaded ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
    </>
  )
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const isWishlisted = useIsWishlisted(product.id)
  const toggleWishlist = useToggleWishlist()

  const discountPct =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null

  const primaryImage = product.images[0] ?? null

  return (
    <motion.div
      className="product-card group relative bg-white dark:bg-ocean-900 rounded-2xl overflow-hidden shadow-sm border border-ocean-100 dark:border-ocean-800 flex flex-col"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Image */}
      <Link
        to={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-ocean-50 dark:bg-ocean-800"
      >
        <ProductImage src={primaryImage} alt={product.name} />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {discountPct && (
            <Badge variant="danger" className="text-xs font-semibold">
              -{discountPct}%
            </Badge>
          )}
          {product.isBestSeller && (
            <Badge variant="gold" className="text-xs font-semibold">
              Best Seller
            </Badge>
          )}
          {!product.inStock && (
            <Badge variant="default" className="text-xs">
              Out of Stock
            </Badge>
          )}
        </div>

        {/* Wishlist button */}
        <button
          onClick={(e) => {
            e.preventDefault()
            toggleWishlist(product.id)
          }}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/80 dark:bg-ocean-900/80 backdrop-blur-sm shadow-sm hover:scale-110 transition-transform"
        >
          <Heart
            size={16}
            className={isWishlisted ? 'text-red-500 fill-red-500' : 'text-ocean-400'}
          />
        </button>
      </Link>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <Link to={`/products/${product.slug}`} className="group/link">
          <h3 className="text-sm font-semibold text-ocean-900 dark:text-white leading-snug line-clamp-2 group-hover/link:text-ocean-700 transition-colors">
            {product.name}
          </h3>
        </Link>

        {product.brand && (
          <p className="text-xs text-ocean-400">{product.brand}</p>
        )}

        <StarRating rating={product.rating} count={product.reviewCount} size={12} />

        <div className="flex items-baseline gap-2 mt-auto pt-1">
          <span className="text-base font-bold text-ocean-900 dark:text-white">
            {formatCurrency(product.price)}
          </span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="text-xs text-ocean-400 line-through">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>

        <button
          disabled={!product.inStock}
          onClick={() => onAddToCart?.(product)}
          className="mt-1 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200
            bg-ocean-700 hover:bg-ocean-900 text-white
            disabled:bg-ocean-100 disabled:text-ocean-400 disabled:cursor-not-allowed
            dark:disabled:bg-ocean-800 dark:disabled:text-ocean-500"
        >
          <ShoppingCart size={14} />
          {product.inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </motion.div>
  )
}
