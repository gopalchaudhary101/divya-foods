import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PageSEO } from '@/components/shared/PageSEO'
import {
  Heart, ShoppingCart, Minus, Plus, Package,
  Truck, Shield, ChevronRight, Star, Pencil, Trash2, RefreshCw,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useProduct, useRelatedProducts, useCategories } from '@/hooks/useProducts'
import { WhatsAppShareButton } from '@/components/shared/WhatsAppShareButton'
import { useWhatsAppConfig } from '@/hooks/useWhatsApp'
import { buildProductShareMessage } from '@/utils/whatsappMessage'
import { ProductCard } from '@/components/shared/ProductCard'
import { useIsWishlisted, useToggleWishlist } from '@/hooks/useWishlist'
import { useReviews, useCanReview, useDeleteReview } from '@/hooks/useReviews'
import { WriteReviewModal } from '@/components/shared/WriteReviewModal'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { useAppSelector } from '@/hooks/useAppSelector'
import { addToCart } from '@/features/cart/cartSlice'
import { StarRating } from '@/components/shared/StarRating'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { formatDate } from '@/utils/formatDate'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'
import toast from 'react-hot-toast'
import { PincodeChecker } from '@/components/shared/PincodeChecker'
import ProductQA from '@/components/shared/ProductQA'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '@/services/api/axiosInstance'
import { queryKeys } from '@/services/queryKeys'
import { getBreadcrumbLD } from '@/utils/structuredData'
import type { Product } from '@/types'

const SITE_URL = 'https://divya-foods.vercel.app'

function getProductLD(p: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    image: p.images,
    description: p.description,
    sku: p.slug,
    ...(p.brand && { brand: { '@type': 'Brand', name: p.brand } }),
    offers: {
      '@type': 'Offer',
      price: p.price,
      priceCurrency: 'INR',
      availability: p.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `https://divya-foods.vercel.app/products/${p.slug}`,
      seller: { '@type': 'Organization', name: 'Divya Foods' },
    },
    ...(p.reviewCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: p.rating,
        reviewCount: p.reviewCount,
      },
    }),
  }
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const dispatch = useAppDispatch()

  const { data: product, isLoading, error } = useProduct(slug ?? '')
  const isWishlisted = useIsWishlisted(product?.id ?? '')
  const toggleWishlist = useToggleWishlist()
  const { data: categories } = useCategories()
  const { data: whatsappConfig } = useWhatsAppConfig()

  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'qa'>('description')
  const [subFrequency, setSubFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('monthly')
  const qc = useQueryClient()
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!product) return
      await axiosInstance.post('/subscriptions', {
        productId: product.id,
        productName: product.name,
        productImage: product.images[0] ?? null,
        productPrice: product.price,
        quantity,
        frequency: subFrequency,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() })
      toast.success('Subscribed! You save 10% on every delivery.')
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Could not create subscription.')
    },
  })
  const [showReviewModal, setShowReviewModal] = useState(false)

  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated)
  const { data: reviewsData } = useReviews(product?.id ?? '', 1)
  const reviews = reviewsData?.data ?? []
  const { data: eligibility } = useCanReview(product?.id ?? '')
  const deleteMutation = useDeleteReview(product?.id ?? '')
  const { data: relatedProducts } = useRelatedProducts(product?.id ?? '')

  const discountPct =
    product?.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null

  const categoryName = categories?.find(c => c.id === product?.category)?.name ?? ''
  const whatsappMessage =
    product && whatsappConfig
      ? buildProductShareMessage(whatsappConfig.productMessageTemplate, product, categoryName)
      : ''

  function handleAddToCart() {
    if (!product) return
    dispatch(
      addToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.images[0] ?? '',
        maxQuantity: product.stockQuantity ?? 10,
      })
    )
    toast.success(`${product.name} added to cart!`)
  }

  function handleAddRelatedToCart(related: Product) {
    dispatch(
      addToCart({
        productId: related.id,
        name: related.name,
        price: related.price,
        quantity: 1,
        image: related.images[0] ?? '',
        maxQuantity: related.stockQuantity ?? 10,
      })
    )
    toast.success(`${related.name} added to cart!`)
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-pulse">
          <div className="aspect-square bg-premium-charcoal rounded-2xl" />
          <div className="flex flex-col gap-4">
            <div className="h-8 bg-premium-navy/10 rounded w-3/4" />
            <div className="h-5 bg-premium-navy/10 rounded w-1/3" />
            <div className="h-10 bg-premium-navy/10 rounded w-1/2 mt-4" />
            <div className="h-12 bg-premium-navy/10 rounded-xl mt-4" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-5xl mb-4">🐟</p>
        <h1 className="font-display text-2xl text-premium-navy dark:text-white mb-2">Product Not Found</h1>
        <p className="text-premium-navy/50 mb-6">This product may have been removed or the URL is incorrect.</p>
        <Link
          to={ROUTES.PRODUCTS}
          className="inline-flex items-center justify-center font-medium transition-all duration-200 bg-premium-gold hover:bg-premium-gold-light text-premium-navy shadow-sm px-7 py-3.5 text-base rounded-xl"
        >
          Browse All Products
        </Link>
      </div>
    )
  }

  const images = product.images.length > 0 ? product.images : [null]

  return (
    <>
      <PageSEO
        title={`${product.name} — Divya Foods`}
        description={
          product.description?.slice(0, 160) ??
          `Buy ${product.name} online. Premium imported seafood delivered across Delhi NCR.`
        }
        ogImage={product.images[0] ?? undefined}
        ogType="product"
      >
        <script type="application/ld+json">{JSON.stringify(getProductLD(product))}</script>
        <script type="application/ld+json">
          {JSON.stringify(getBreadcrumbLD([
            { name: 'Home', url: SITE_URL },
            { name: 'Products', url: `${SITE_URL}${ROUTES.PRODUCTS}` },
            { name: product.name, url: `${SITE_URL}${ROUTES.PRODUCTS}/${product.slug}` },
          ]))}
        </script>
      </PageSEO>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-premium-navy/50 mb-6 flex-wrap">
          <Link to={ROUTES.HOME} className="hover:text-premium-gold transition-colors">Home</Link>
          <ChevronRight size={13} />
          <Link to={ROUTES.PRODUCTS} className="hover:text-premium-gold transition-colors">Products</Link>
          <ChevronRight size={13} />
          <span className="text-premium-navy dark:text-ocean-200 font-medium truncate max-w-[200px]">
            {product.name}
          </span>
        </nav>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          {/* ── Gallery ─────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <motion.div
              key={activeImage}
              className="relative aspect-square rounded-2xl overflow-hidden bg-premium-navy border border-white/5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              {images[activeImage] ? (
                <img
                  src={images[activeImage]!}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={80} className="text-premium-muted" />
                </div>
              )}

              {discountPct && (
                <div className="absolute top-4 left-4">
                  <Badge variant="danger" className="text-sm font-bold px-3 py-1">
                    -{discountPct}%
                  </Badge>
                </div>
              )}
            </motion.div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={[
                      'shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all',
                      activeImage === i
                        ? 'border-premium-gold scale-105'
                        : 'border-white/10 hover:border-premium-gold/50',
                    ].join(' ')}
                  >
                    {img ? (
                      <img src={img} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-premium-navy flex items-center justify-center">
                        <Package size={20} className="text-premium-muted" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Info ────────────────────────────────────── */}
          <div className="flex flex-col gap-5">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {product.isBestSeller && <Badge variant="gold">Best Seller</Badge>}
              {product.isFeatured && <Badge variant="info">Featured</Badge>}
              {!product.inStock && <Badge variant="danger">Out of Stock</Badge>}
            </div>

            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-premium-navy dark:text-white leading-snug">
                {product.name}
              </h1>
              {product.brand && (
                <p className="mt-1 text-sm text-premium-navy/50">by {product.brand}</p>
              )}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3">
              <StarRating rating={product.rating} count={product.reviewCount} size={16} />
              <button
                onClick={() => setActiveTab('reviews')}
                className="text-sm text-premium-navy/60 hover:text-premium-gold underline underline-offset-2"
              >
                {product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'}
              </button>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-premium-gold">
                {formatCurrency(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <>
                  <span className="text-lg text-premium-navy/40 line-through">
                    {formatCurrency(product.originalPrice)}
                  </span>
                  <Badge variant="danger" className="text-sm font-semibold px-2 py-0.5">
                    Save {discountPct}%
                  </Badge>
                </>
              )}
            </div>

            {/* Meta attributes */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {product.weight && (
                <div>
                  <span className="text-premium-navy/50">Weight: </span>
                  <span className="font-medium text-premium-navy dark:text-ocean-100">{product.weight}</span>
                </div>
              )}
              {product.origin && (
                <div>
                  <span className="text-premium-navy/50">Origin: </span>
                  <span className="font-medium text-premium-navy dark:text-ocean-100">{product.origin}</span>
                </div>
              )}
              {product.brand && (
                <div>
                  <span className="text-premium-navy/50">Brand: </span>
                  <span className="font-medium text-premium-navy dark:text-ocean-100">{product.brand}</span>
                </div>
              )}
            </div>

            {/* Quantity + Cart */}
            {product.inStock ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-premium-navy dark:text-ocean-200">Quantity</span>
                  <div className="flex items-center border border-premium-navy/15 dark:border-ocean-700 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="px-3 py-2 hover:bg-premium-navy/5 dark:hover:bg-ocean-800 disabled:opacity-40 transition-colors"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-4 py-2 min-w-[3rem] text-center text-sm font-semibold">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(q + 1, product.stockQuantity ?? 10))}
                      disabled={quantity >= (product.stockQuantity ?? 10)}
                      className="px-3 py-2 hover:bg-premium-navy/5 dark:hover:bg-ocean-800 disabled:opacity-40 transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-premium-navy/50">{product.stockQuantity} available</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 flex items-center justify-center gap-2.5 py-3.5 px-7 rounded-xl text-base font-medium bg-premium-gold hover:bg-premium-gold-light text-premium-navy shadow-sm transition-colors"
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </button>
                  <button
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                    className={[
                      'px-4 rounded-xl border-2 transition-all duration-200 hover:scale-105',
                      isWishlisted
                        ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                        : 'border-premium-navy/15 dark:border-ocean-700 hover:border-red-300',
                    ].join(' ')}
                  >
                    <Heart
                      size={20}
                      className={isWishlisted ? 'text-red-500 fill-red-500' : 'text-premium-teal'}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="lg" disabled className="cursor-not-allowed">
                Out of Stock
              </Button>
            )}

            {whatsappMessage && (
              <WhatsAppShareButton
                message={whatsappMessage}
                source="product_detail"
                trackItems={[{ productId: product.id, productName: product.name }]}
                className="w-full"
              />
            )}

            {/* Trust signals */}
            <div className="flex flex-col gap-2 pt-2 border-t border-premium-navy/10 dark:border-ocean-800">
              <div className="flex items-center gap-2.5 text-sm text-premium-navy/70 dark:text-ocean-300">
                <Truck size={15} className="text-premium-teal shrink-0" />
                Free delivery on orders above {formatCurrency(CONFIG.DELIVERY.FREE_DELIVERY_ABOVE)}
              </div>
              <div className="flex items-center gap-2.5 text-sm text-premium-navy/70 dark:text-ocean-300">
                <Shield size={15} className="text-premium-teal shrink-0" />
                100% fresh quality guarantee
              </div>
            </div>

            {/* Subscribe & Save */}
            {product.inStock && isAuthenticated && (
              <div className="border border-premium-navy/15 dark:border-ocean-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} className="text-green-600" />
                  <span className="text-sm font-semibold text-premium-navy dark:text-ocean-200">
                    Subscribe &amp; Save 10%
                  </span>
                  <Badge variant="success" className="text-[10px]">Auto-delivery</Badge>
                </div>
                <p className="text-xs text-premium-navy/60">
                  {formatCurrency(product.price * 0.9)} / delivery — cancel anytime
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(['weekly', 'biweekly', 'monthly'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setSubFrequency(f)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        subFrequency === f
                          ? 'bg-green-600 text-white border-green-600'
                          : 'border-premium-navy/15 dark:border-ocean-700 text-premium-navy/60 dark:text-ocean-400 hover:border-green-400'
                      }`}
                    >
                      {f === 'biweekly' ? 'Every 2 weeks' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => subscribeMutation.mutate()}
                  disabled={subscribeMutation.isPending}
                  className="w-full py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {subscribeMutation.isPending ? 'Subscribing…' : 'Subscribe & Save'}
                </button>
              </div>
            )}

            {/* Pincode delivery checker */}
            <PincodeChecker />
          </div>
        </div>

        {/* ── Tabs: Description / Reviews ────────────── */}
        <div className="mb-16">
          <div className="flex gap-1 border-b border-premium-navy/10 dark:border-ocean-800 mb-6">
            {(['description', 'reviews', 'qa'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'px-5 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
                  activeTab === tab
                    ? 'border-premium-gold text-premium-navy dark:text-white'
                    : 'border-transparent text-premium-navy/40 hover:text-premium-gold',
                ].join(' ')}
              >
                {tab === 'reviews' ? `Reviews (${product.reviewCount})` : tab === 'qa' ? 'Q&A' : 'Description'}
              </button>
            ))}
          </div>

          {activeTab === 'qa' ? (
            <div className="max-w-3xl">
              <ProductQA productId={product.id} />
            </div>
          ) : activeTab === 'description' ? (
            <div className="max-w-3xl">
              <p className="text-premium-navy/80 dark:text-ocean-200 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="default" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl">
              {/* Rating summary + write CTA */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                {product.reviewCount > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-premium-navy dark:text-white">{product.rating.toFixed(1)}</p>
                      <StarRating rating={product.rating} showCount={false} size={14} />
                      <p className="text-xs text-premium-navy/50 mt-1">{product.reviewCount} review{product.reviewCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )}
                {isAuthenticated && eligibility?.canReview && (
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-premium-navy/15 dark:border-ocean-700 rounded-xl text-sm font-medium text-premium-navy/70 dark:text-ocean-200 hover:border-premium-gold hover:text-premium-gold transition-all"
                  >
                    <Pencil size={14} /> Write a Review
                  </button>
                )}
                {isAuthenticated && eligibility?.reason === 'already_reviewed' && (
                  <span className="text-xs text-premium-teal flex items-center gap-1">
                    ✓ You've reviewed this product
                  </span>
                )}
              </div>

              {/* Reviews list */}
              {reviews.length === 0 ? (
                <div className="text-center py-12 text-premium-navy/40">
                  <Star size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No reviews yet.</p>
                  {isAuthenticated && eligibility?.canReview && (
                    <button
                      onClick={() => setShowReviewModal(true)}
                      className="mt-3 text-premium-teal underline text-sm"
                    >
                      Be the first to review this product
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {reviews.map(review => (
                    <div
                      key={review.id}
                      className="p-5 rounded-xl bg-premium-navy border border-white/5"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <p className="font-medium text-white text-sm">{review.userName}</p>
                          <StarRating rating={review.rating} showCount={false} size={13} />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-xs text-premium-muted">{formatDate(review.createdAt)}</p>
                            {review.isVerifiedPurchase && (
                              <Badge variant="success" className="text-[10px] mt-1">Verified Purchase</Badge>
                            )}
                          </div>
                          {eligibility?.reviewId === review.id && (
                            <button
                              onClick={() => deleteMutation.mutate(review.id)}
                              aria-label="Delete your review"
                              className="p-1 text-premium-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-premium-cream/80 leading-relaxed">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Related products — frequently bought together + same-category blend */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mt-12 pt-8 border-t border-premium-navy/10 dark:border-ocean-800">
            <h2 className="font-display text-xl font-semibold text-premium-navy dark:text-white mb-5">
              You May Also Like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p} onAddToCart={handleAddRelatedToCart} />
              ))}
            </div>
          </div>
        )}
      </div>

      {showReviewModal && product && (
        <WriteReviewModal
          productId={product.id}
          productName={product.name}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </>
  )
}
