import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Minus, Plus, ShoppingBag, Trash2, ShoppingCart } from 'lucide-react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { updateQuantity, removeFromCart } from '@/features/cart/cartSlice'
import { setCartOpen } from '@/store/slices/uiSlice'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'

export function CartDrawer() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const isOpen = useAppSelector((s) => s.ui.isCartOpen)
  const { items, totalItems, totalPrice } = useAppSelector((s) => s.cart)

  const drawerRef = useRef<HTMLElement>(null)
  const deliveryCharge = totalPrice >= CONFIG.DELIVERY.FREE_DELIVERY_ABOVE ? 0 : CONFIG.DELIVERY.STANDARD_CHARGE
  const orderTotal = totalPrice + deliveryCharge

  useFocusTrap(drawerRef, isOpen)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(setCartOpen(false))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, dispatch])

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  function close() {
    dispatch(setCartOpen(false))
  }

  function goTo(path: string) {
    close()
    navigate(path)
  }

  const drawer = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/40 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            className="fixed top-0 right-0 h-full w-full max-w-sm bg-premium-charcoal shadow-2xl z-50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-premium-cream/80" aria-hidden="true" />
                <span id="cart-drawer-title" className="font-semibold text-white">
                  Your Cart
                </span>
                {totalItems > 0 && (
                  <span className="ml-1 text-xs bg-premium-gold text-premium-navy rounded-full px-2 py-0.5">
                    {totalItems}
                  </span>
                )}
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg text-premium-cream/80 hover:bg-white/10 transition-colors"
                aria-label="Close cart"
              >
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-4 px-5">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-center py-16">
                  <ShoppingBag size={48} className="text-premium-muted" />
                  <p className="text-premium-cream/80 font-medium">Your cart is empty</p>
                  <p className="text-sm text-premium-muted">Add some premium seafood to get started!</p>
                  <Button variant="premiumOutline" size="sm" className="!border-white/20 !text-white hover:!bg-white/10" onClick={() => goTo(ROUTES.PRODUCTS)}>
                    Browse Products
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex gap-3 pb-4 border-b border-white/5 last:border-0"
                    >
                      {/* Image */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-premium-navy">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag size={20} className="text-premium-muted" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                          {item.name}
                        </p>
                        <p className="text-xs text-premium-muted mt-0.5">
                          {formatCurrency(item.price)} each
                        </p>

                        {/* Qty + Remove */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center border border-white/10 rounded-lg overflow-hidden">
                            <button
                              aria-label={`Decrease quantity of ${item.name}`}
                              onClick={() =>
                                item.quantity > 1
                                  ? dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }))
                                  : dispatch(removeFromCart(item.productId))
                              }
                              className="px-2 py-1 hover:bg-white/5 transition-colors text-premium-cream/80"
                            >
                              <Minus size={12} aria-hidden="true" />
                            </button>
                            <span aria-label={`Quantity: ${item.quantity}`} className="px-3 text-sm font-semibold text-white">{item.quantity}</span>
                            <button
                              aria-label={`Increase quantity of ${item.name}`}
                              onClick={() =>
                                dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }))
                              }
                              disabled={item.quantity >= item.maxQuantity}
                              className="px-2 py-1 hover:bg-white/5 disabled:opacity-40 transition-colors text-premium-cream/80"
                            >
                              <Plus size={12} aria-hidden="true" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-premium-gold">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                            <button
                              onClick={() => dispatch(removeFromCart(item.productId))}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors"
                              aria-label={`Remove ${item.name} from cart`}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="shrink-0 border-t border-white/10 px-5 py-4 bg-premium-navy/50">
                {/* Free delivery progress */}
                {totalPrice < CONFIG.DELIVERY.FREE_DELIVERY_ABOVE && (
                  <div className="mb-4">
                    <p className="text-xs text-premium-muted mb-1.5">
                      Add <span className="font-semibold text-premium-cream/90">
                        {formatCurrency(CONFIG.DELIVERY.FREE_DELIVERY_ABOVE - totalPrice)}
                      </span> more for free delivery
                    </p>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-premium-teal rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((totalPrice / CONFIG.DELIVERY.FREE_DELIVERY_ABOVE) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-sm text-premium-cream/80">
                    <span>Subtotal ({totalItems} items)</span>
                    <span>{formatCurrency(totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-premium-cream/80">
                    <span>Delivery</span>
                    <span className={deliveryCharge === 0 ? 'text-premium-teal font-medium' : ''}>
                      {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-2 mt-2">
                    <span>Total</span>
                    <span className="text-premium-gold">{formatCurrency(orderTotal)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => goTo(ROUTES.CHECKOUT)}
                    variant="premium"
                    size="md"
                    className="w-full"
                  >
                    Proceed to Checkout
                  </Button>
                  <Button
                    onClick={() => goTo(ROUTES.CART)}
                    variant="premiumOutline"
                    size="md"
                    className="w-full !border-white/20 !text-white hover:!bg-white/10"
                  >
                    View Full Cart
                  </Button>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )

  return createPortal(drawer, document.body)
}
