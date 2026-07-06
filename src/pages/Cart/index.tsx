import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, Tag, ChevronRight, Truck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { updateQuantity, removeFromCart, clearCart } from '@/features/cart/cartSlice'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'

export default function CartPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { items, totalItems, totalPrice } = useAppSelector((s) => s.cart)
  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState('')

  const deliveryCharge = totalPrice >= CONFIG.DELIVERY.FREE_DELIVERY_ABOVE ? 0 : CONFIG.DELIVERY.STANDARD_CHARGE
  const orderTotal = totalPrice + deliveryCharge
  const freeDeliveryRemaining = Math.max(0, CONFIG.DELIVERY.FREE_DELIVERY_ABOVE - totalPrice)

  function handleCoupon(e: React.FormEvent) {
    e.preventDefault()
    // Coupon validation happens during checkout — this just passes the code through
    if (!couponInput.trim()) {
      setCouponError('Please enter a coupon code')
      return
    }
    setCouponError('')
    // Navigate to checkout with coupon pre-filled via state
    navigate(ROUTES.CHECKOUT, { state: { couponCode: couponInput.trim().toUpperCase() } })
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <>
        <Helmet><title>Your Cart — Divya Luxury Seafoods</title></Helmet>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <ShoppingBag size={64} className="mx-auto text-premium-navy/20 dark:text-ocean-700 mb-6" />
          <h1 className="font-display text-3xl font-semibold text-premium-navy dark:text-white mb-2">
            Your cart is empty
          </h1>
          <p className="text-premium-navy/50 mb-8 max-w-sm mx-auto">
            Looks like you haven't added anything yet. Explore our premium seafood and gourmet imports.
          </p>
          <Button
            onClick={() => navigate(ROUTES.PRODUCTS)}
            variant="premium"
            size="lg"
            leftIcon={<ShoppingBag size={18} />}
          >
            Browse Products
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet><title>{`Your Cart (${totalItems} items) — Divya Luxury Seafoods`}</title></Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-premium-navy/50 mb-6">
          <Link to={ROUTES.HOME} className="hover:text-premium-gold transition-colors">Home</Link>
          <ChevronRight size={13} />
          <span className="text-premium-navy dark:text-ocean-200 font-medium">Cart</span>
        </nav>

        <h1 className="font-display text-3xl font-semibold text-premium-navy dark:text-white mb-8">
          Shopping Cart
          <span className="ml-3 text-lg font-normal text-premium-navy/40">({totalItems} items)</span>
        </h1>

        {/* Free delivery banner */}
        {freeDeliveryRemaining > 0 ? (
          <div className="flex items-center gap-3 bg-premium-teal/10 border border-premium-teal/30 rounded-xl px-4 py-3 mb-6">
            <Truck size={16} className="text-premium-teal shrink-0" />
            <p className="text-sm text-premium-navy/80 dark:text-premium-teal">
              Add <strong>{formatCurrency(freeDeliveryRemaining)}</strong> more to get <strong>FREE delivery</strong>!
            </p>
            <div className="flex-1 h-1.5 bg-premium-teal/20 rounded-full ml-2 overflow-hidden">
              <div
                className="h-full bg-premium-teal rounded-full transition-all duration-500"
                style={{ width: `${Math.min((totalPrice / CONFIG.DELIVERY.FREE_DELIVERY_ABOVE) * 100, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-premium-teal/10 border border-premium-teal/30 rounded-xl px-4 py-3 mb-6">
            <Truck size={16} className="text-premium-teal" />
            <p className="text-sm font-medium text-premium-navy/80 dark:text-premium-teal">
              You qualify for FREE delivery!
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Cart items ──────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-4 bg-premium-charcoal border border-white/5 rounded-2xl p-4"
                >
                  {/* Image */}
                  <Link
                    to={`/products/${item.productId}`}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-premium-navy"
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={24} className="text-premium-muted" />
                      </div>
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/products/${item.productId}`}
                      className="text-sm sm:text-base font-medium text-white hover:text-premium-gold line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-premium-muted mt-0.5">{formatCurrency(item.price)} per unit</p>

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      {/* Qty stepper */}
                      <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
                        <button
                          onClick={() =>
                            item.quantity > 1
                              ? dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }))
                              : dispatch(removeFromCart(item.productId))
                          }
                          className="px-3 py-3 hover:bg-white/5 transition-colors text-premium-cream/80"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="px-4 py-3 text-sm font-semibold min-w-[2.5rem] text-center text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }))
                          }
                          disabled={item.quantity >= item.maxQuantity}
                          className="px-3 py-3 hover:bg-white/5 disabled:opacity-40 transition-colors text-premium-cream/80"
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Line total + remove */}
                      <div className="flex items-center gap-3">
                        <span className="text-base font-semibold text-premium-gold">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        <button
                          onClick={() => dispatch(removeFromCart(item.productId))}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Clear cart */}
            <div className="flex justify-end mt-2">
              <button
                onClick={() => dispatch(clearCart())}
                className="text-sm text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Clear cart
              </button>
            </div>
          </div>

          {/* ── Order summary ────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-premium-charcoal border border-white/5 rounded-2xl p-6 sticky top-24">
              <h2 className="font-display text-lg font-semibold text-white mb-5">
                Order Summary
              </h2>

              {/* Price breakdown */}
              <div className="flex flex-col gap-3 pb-4 border-b border-white/10">
                <div className="flex justify-between text-sm text-premium-cream/80">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm text-premium-cream/80">
                  <span>Delivery charge</span>
                  <span className={deliveryCharge === 0 ? 'text-premium-teal font-medium' : ''}>
                    {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-base font-semibold text-white py-4">
                <span>Total</span>
                <span className="text-premium-gold">{formatCurrency(orderTotal)}</span>
              </div>

              {/* Coupon */}
              <form onSubmit={handleCoupon} className="mb-4">
                <label className="df-eyebrow mb-2 block">
                  Coupon Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-premium-muted" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                      placeholder="DIVYA10"
                      className="w-full pl-8 pr-3 py-2.5 text-sm border border-white/10 rounded-xl bg-premium-navy text-white placeholder-premium-muted focus:outline-none focus:ring-2 focus:ring-premium-gold"
                    />
                  </div>
                  <Button type="submit" variant="premiumOutline" size="sm" className="!border-white/20 !text-white hover:!bg-white/10">
                    Apply
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-400 mt-1">{couponError}</p>
                )}
                <p className="text-xs text-premium-muted mt-1">Coupon will be applied at checkout</p>
              </form>

              <Button
                onClick={() => navigate(ROUTES.CHECKOUT)}
                variant="premium"
                size="lg"
                className="w-full"
              >
                Proceed to Checkout
              </Button>

              <Link
                to={ROUTES.PRODUCTS}
                className="block text-center text-sm text-premium-teal hover:text-premium-gold mt-3 transition-colors"
              >
                Continue Shopping
              </Link>

              {/* Trust signals */}
              <div className="mt-5 pt-4 border-t border-white/10 text-xs text-premium-muted space-y-1.5">
                <p>🔒 Secure checkout — Razorpay encrypted</p>
                <p>🚚 Delivery in Delhi NCR, Gurgaon, Noida, Greater Noida</p>
                <p>❄️ All seafood shipped in temperature-controlled packaging</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
