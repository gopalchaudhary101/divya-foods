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
        <Helmet><title>Your Cart — Divya Foods</title></Helmet>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <ShoppingBag size={64} className="mx-auto text-ocean-200 dark:text-ocean-700 mb-6" />
          <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white mb-2">
            Your cart is empty
          </h1>
          <p className="text-ocean-400 mb-8 max-w-sm mx-auto">
            Looks like you haven't added anything yet. Explore our premium seafood and gourmet imports.
          </p>
          <Button
            onClick={() => navigate(ROUTES.PRODUCTS)}
            variant="primary"
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
      <Helmet><title>Your Cart ({totalItems} items) — Divya Foods</title></Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-ocean-400 mb-6">
          <Link to={ROUTES.HOME} className="hover:text-ocean-700 transition-colors">Home</Link>
          <ChevronRight size={13} />
          <span className="text-ocean-700 dark:text-ocean-200 font-medium">Cart</span>
        </nav>

        <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white mb-8">
          Shopping Cart
          <span className="ml-3 text-lg font-normal text-ocean-400">({totalItems} items)</span>
        </h1>

        {/* Free delivery banner */}
        {freeDeliveryRemaining > 0 ? (
          <div className="flex items-center gap-3 bg-mint-50 dark:bg-mint-900/20 border border-mint-200 dark:border-mint-800 rounded-xl px-4 py-3 mb-6">
            <Truck size={16} className="text-mint-600 shrink-0" />
            <p className="text-sm text-mint-700 dark:text-mint-300">
              Add <strong>{formatCurrency(freeDeliveryRemaining)}</strong> more to get <strong>FREE delivery</strong>!
            </p>
            <div className="flex-1 h-1.5 bg-mint-200 dark:bg-mint-800 rounded-full ml-2 overflow-hidden">
              <div
                className="h-full bg-mint-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((totalPrice / CONFIG.DELIVERY.FREE_DELIVERY_ABOVE) * 100, 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-mint-50 dark:bg-mint-900/20 border border-mint-200 dark:border-mint-800 rounded-xl px-4 py-3 mb-6">
            <Truck size={16} className="text-mint-600" />
            <p className="text-sm font-medium text-mint-700 dark:text-mint-300">
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
                  className="flex gap-4 bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-4"
                >
                  {/* Image */}
                  <Link
                    to={`/products/${item.productId}`}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-ocean-50 dark:bg-ocean-800"
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={24} className="text-ocean-200" />
                      </div>
                    )}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/products/${item.productId}`}
                      className="text-sm sm:text-base font-medium text-ocean-900 dark:text-white hover:text-ocean-700 line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-ocean-400 mt-0.5">{formatCurrency(item.price)} per unit</p>

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      {/* Qty stepper */}
                      <div className="flex items-center border border-ocean-200 dark:border-ocean-700 rounded-xl overflow-hidden">
                        <button
                          onClick={() =>
                            item.quantity > 1
                              ? dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }))
                              : dispatch(removeFromCart(item.productId))
                          }
                          className="px-3 py-3 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="px-4 py-3 text-sm font-semibold min-w-[2.5rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }))
                          }
                          disabled={item.quantity >= item.maxQuantity}
                          className="px-3 py-3 hover:bg-ocean-50 dark:hover:bg-ocean-800 disabled:opacity-40 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Line total + remove */}
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-ocean-900 dark:text-white">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        <button
                          onClick={() => dispatch(removeFromCart(item.productId))}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                className="text-sm text-red-400 hover:text-red-600 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Clear cart
              </button>
            </div>
          </div>

          {/* ── Order summary ────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6 sticky top-24">
              <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white mb-5">
                Order Summary
              </h2>

              {/* Price breakdown */}
              <div className="flex flex-col gap-3 pb-4 border-b border-ocean-100 dark:border-ocean-800">
                <div className="flex justify-between text-sm text-ocean-600 dark:text-ocean-300">
                  <span>Subtotal ({totalItems} items)</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm text-ocean-600 dark:text-ocean-300">
                  <span>Delivery charge</span>
                  <span className={deliveryCharge === 0 ? 'text-mint-500 font-medium' : ''}>
                    {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between text-base font-bold text-ocean-900 dark:text-white py-4">
                <span>Total</span>
                <span>{formatCurrency(orderTotal)}</span>
              </div>

              {/* Coupon */}
              <form onSubmit={handleCoupon} className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-2 block">
                  Coupon Code
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                      placeholder="DIVYA10"
                      className="w-full pl-8 pr-3 py-2.5 text-sm border border-ocean-200 dark:border-ocean-700 rounded-xl dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm">
                    Apply
                  </Button>
                </div>
                {couponError && (
                  <p className="text-xs text-red-500 mt-1">{couponError}</p>
                )}
                <p className="text-xs text-ocean-400 mt-1">Coupon will be applied at checkout</p>
              </form>

              <Button
                onClick={() => navigate(ROUTES.CHECKOUT)}
                variant="primary"
                size="lg"
                className="w-full"
              >
                Proceed to Checkout
              </Button>

              <Link
                to={ROUTES.PRODUCTS}
                className="block text-center text-sm text-ocean-500 hover:text-ocean-700 mt-3 transition-colors"
              >
                Continue Shopping
              </Link>

              {/* Trust signals */}
              <div className="mt-5 pt-4 border-t border-ocean-100 dark:border-ocean-800 text-xs text-ocean-400 space-y-1.5">
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
