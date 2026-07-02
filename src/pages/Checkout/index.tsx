import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { MapPin, ShoppingBag, CreditCard, ChevronRight, Tag, Truck, Shield } from 'lucide-react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { clearCart } from '@/features/cart/cartSlice'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { orderApi } from '@/services/api/orderApi'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'

// ─── Razorpay types ───────────────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}
interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  image?: string
  prefill?: { name: string; email: string; contact: string }
  theme?: { color: string }
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void
  modal?: { ondismiss?: () => void }
}
interface RazorpayInstance { open(): void }

// ─── Form type ────────────────────────────────────────────────────────────────
interface AddressForm {
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  pincode: string
}

const STEPS = ['Delivery', 'Review', 'Payment'] as const

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const location  = useLocation()
  const dispatch  = useAppDispatch()

  const { items, totalPrice } = useAppSelector((s) => s.cart)
  const user = useAppSelector((s) => s.auth.user)
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)

  const [step, setStep]         = useState(0)    // 0=address, 1=review, 2=payment
  const [coupon, setCoupon]     = useState((location.state as { couponCode?: string })?.couponCode ?? '')
  const [couponApplied, setCouponApplied] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]       = useState('')

  const deliveryCharge = totalPrice >= CONFIG.DELIVERY.FREE_DELIVERY_ABOVE ? 0 : CONFIG.DELIVERY.STANDARD_CHARGE
  const orderTotal     = totalPrice + deliveryCharge - discount

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<AddressForm>({
    defaultValues: {
      fullName:     user?.name ?? '',
      phone:        user?.phone ?? '',
      city:         'New Delhi',
      state:        'Delhi',
      addressLine2: '',
      pincode:      '',
      addressLine1: '',
    },
  })

  // Redirect if cart is empty or not logged in
  useEffect(() => {
    if (!isAuthenticated) { navigate(ROUTES.AUTH.LOGIN, { state: { from: ROUTES.CHECKOUT } }); return }
    if (items.length === 0) { navigate(ROUTES.CART) }
  }, [isAuthenticated, items.length, navigate])

  // Pre-load Razorpay script in the background
  useEffect(() => { loadRazorpayScript() }, [])

  // ── Step 1: address form submit ───────────────────────────────────────────
  function onAddressSubmit() { setStep(1) }

  // ── Pay button ────────────────────────────────────────────────────────────
  async function handlePay() {
    setError('')
    setIsLoading(true)

    const addr = getValues()
    const loaded = await loadRazorpayScript()
    if (!loaded) {
      setError('Could not load payment gateway. Check your internet connection.')
      setIsLoading(false)
      return
    }

    try {
      // Step 1 — create order on backend + get Razorpay order ID
      const initiated = await orderApi.initiate(
        {
          label:        'Delivery',
          fullName:     addr.fullName,
          phone:        addr.phone,
          addressLine1: addr.addressLine1,
          addressLine2: addr.addressLine2,
          city:         addr.city,
          state:        addr.state,
          pincode:      addr.pincode,
        },
        items,
        couponApplied ? coupon : undefined,
      )

      // Step 2 — open Razorpay popup
      const rzp = new window.Razorpay({
        key:       initiated.razorpayKeyId,
        amount:    Math.round(initiated.amount * 100),
        currency:  initiated.currency,
        order_id:  initiated.razorpayOrderId,
        name:      'Divya Foods',
        description: `Order ${initiated.orderNumber}`,
        image:     '/logo.png',
        prefill: {
          name:    addr.fullName,
          email:   user?.email ?? '',
          contact: addr.phone,
        },
        theme: { color: '#0E4D8A' },
        handler: async (response) => {
          // Step 3 — verify payment signature on backend
          try {
            await orderApi.verifyPayment(
              initiated.orderId,
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
            )
            // Clear Redux cart after confirmed payment
            dispatch(clearCart())
            navigate(`/orders/${initiated.orderId}`, { state: { justOrdered: true } })
          } catch {
            setError('Payment received but verification failed. Contact support with order ' + initiated.orderNumber)
            setIsLoading(false)
          }
        },
        modal: {
          ondismiss: () => {
            setError('Payment cancelled. Your order is saved — you can retry from your orders page.')
            setIsLoading(false)
          },
        },
      })
      rzp.open()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
      setIsLoading(false)
    }
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  function StepIndicator() {
    return (
      <div className="flex items-center justify-center gap-0 mb-10">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${i < step ? 'bg-mint-500 text-white' : i === step ? 'bg-ocean-700 text-white' : 'bg-ocean-100 dark:bg-ocean-800 text-ocean-400'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-ocean-700 dark:text-ocean-200 font-semibold' : 'text-ocean-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-16 mb-4 mx-1 transition-colors ${i < step ? 'bg-mint-400' : 'bg-ocean-100 dark:bg-ocean-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <>
      <Helmet><title>Checkout — Divya Foods</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <h1 className="font-display text-2xl font-semibold text-ocean-900 dark:text-white mb-6 text-center">
          Secure Checkout
        </h1>
        <StepIndicator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left panel ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">

            {/* STEP 0 — Delivery address */}
            {step === 0 && (
              <form onSubmit={handleSubmit(onAddressSubmit)} className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white mb-5 flex items-center gap-2">
                  <MapPin size={18} className="text-ocean-500" />
                  Delivery Address
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Full Name *</label>
                    <input {...register('fullName', { required: 'Required' })}
                      className="input-field w-full" placeholder="Raj Kumar" />
                    {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Phone *</label>
                    <input {...register('phone', { required: 'Required', pattern: { value: /^[0-9+]{10,13}$/, message: 'Enter a valid phone number' } })}
                      type="tel" className="input-field w-full" placeholder="+91 9999123456" />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Address Line 1 *</label>
                    <input {...register('addressLine1', { required: 'Required', minLength: { value: 5, message: 'Too short' } })}
                      className="input-field w-full" placeholder="House No., Street, Colony" />
                    {errors.addressLine1 && <p className="text-xs text-red-500 mt-1">{errors.addressLine1.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Address Line 2</label>
                    <input {...register('addressLine2')}
                      className="input-field w-full" placeholder="Landmark, Area (optional)" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">City *</label>
                    <input {...register('city', { required: 'Required' })}
                      className="input-field w-full" placeholder="New Delhi" />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">State *</label>
                    <input {...register('state', { required: 'Required' })}
                      className="input-field w-full" placeholder="Delhi" />
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">Pincode *</label>
                    <input {...register('pincode', { required: 'Required', pattern: { value: /^[0-9]{6}$/, message: '6-digit pincode required' } })}
                      className="input-field w-full" placeholder="110044" maxLength={6} />
                    {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode.message}</p>}
                  </div>
                </div>

                <p className="text-xs text-ocean-400 mt-4 flex items-center gap-1.5">
                  <Truck size={13} />
                  We deliver to Delhi NCR, Gurgaon, Noida and Greater Noida
                </p>

                <Button type="submit" variant="primary" size="lg" className="w-full mt-6" rightIcon={<ChevronRight size={16} />}>
                  Continue to Review
                </Button>
              </form>
            )}

            {/* STEP 1 — Review order */}
            {step === 1 && (
              <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white mb-5 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-ocean-500" />
                  Review Your Order
                </h2>

                {/* Address preview */}
                <div className="bg-ocean-50 dark:bg-ocean-800 rounded-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-ocean-400 uppercase mb-1">Delivering to</p>
                  {(() => { const v = getValues(); return (
                    <p className="text-sm text-ocean-800 dark:text-ocean-100">
                      {v.fullName} · {v.phone}<br />
                      {v.addressLine1}{v.addressLine2 ? `, ${v.addressLine2}` : ''}<br />
                      {v.city}, {v.state} — {v.pincode}
                    </p>
                  )})()}
                  <button onClick={() => setStep(0)} className="text-xs text-ocean-500 hover:text-ocean-700 mt-1">
                    Change address
                  </button>
                </div>

                {/* Items */}
                <div className="divide-y divide-ocean-100 dark:divide-ocean-800 mb-5">
                  {items.map(item => (
                    <div key={item.productId} className="flex gap-3 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-ocean-50 dark:bg-ocean-800">
                        {item.image
                          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={16} className="text-ocean-200" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ocean-900 dark:text-white line-clamp-1">{item.name}</p>
                        <p className="text-xs text-ocean-400">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                      </div>
                      <span className="text-sm font-bold text-ocean-900 dark:text-white shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className="mb-5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400" />
                      <input
                        value={coupon}
                        onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponApplied(false); setDiscount(0) }}
                        placeholder="COUPON CODE"
                        className="input-field w-full pl-8 text-sm"
                      />
                    </div>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => { if (coupon) { setCouponApplied(true); setDiscount(0) /* applied at backend */ } }}
                    >
                      Apply
                    </Button>
                  </div>
                  {couponApplied && <p className="text-xs text-mint-600 mt-1">Coupon will be applied at payment</p>}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="md" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                  <Button variant="primary" size="md" className="flex-1" rightIcon={<ChevronRight size={16} />} onClick={() => setStep(2)}>
                    Proceed to Pay
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2 — Payment */}
            {step === 2 && (
              <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold text-ocean-900 dark:text-white mb-5 flex items-center gap-2">
                  <CreditCard size={18} className="text-ocean-500" />
                  Payment
                </h2>

                <div className="bg-ocean-50 dark:bg-ocean-800 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <img src="https://razorpay.com/favicon.png" alt="Razorpay" className="w-5 h-5" />
                    <span className="font-medium text-ocean-900 dark:text-white">Razorpay Secure Payment</span>
                  </div>
                  <p className="text-sm text-ocean-500">
                    Pay securely using UPI, Net Banking, Credit/Debit Card, or Wallets. Your payment details are encrypted and never stored by us.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" size="md" className="flex-1" onClick={() => setStep(1)} disabled={isLoading}>
                    Back
                  </Button>
                  <Button
                    variant="primary" size="lg" className="flex-1"
                    onClick={handlePay}
                    isLoading={isLoading}
                    leftIcon={<Shield size={16} />}
                  >
                    Pay {formatCurrency(orderTotal)}
                  </Button>
                </div>

                <p className="text-xs text-ocean-400 text-center mt-4 flex items-center justify-center gap-1">
                  <Shield size={11} />
                  256-bit SSL encrypted · Powered by Razorpay
                </p>
              </div>
            )}
          </div>

          {/* ── Order summary sidebar ───────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 rounded-2xl p-5 sticky top-24">
              <h3 className="font-display font-semibold text-ocean-900 dark:text-white mb-4">Order Summary</h3>

              <div className="flex flex-col gap-2 text-sm pb-4 border-b border-ocean-100 dark:border-ocean-800">
                <div className="flex justify-between text-ocean-600 dark:text-ocean-300">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-ocean-600 dark:text-ocean-300">
                  <span>Delivery</span>
                  <span className={deliveryCharge === 0 ? 'text-mint-500 font-medium' : ''}>
                    {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-mint-600">
                    <span>Coupon discount</span>
                    <span>−{formatCurrency(discount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-bold text-ocean-900 dark:text-white py-4 text-base">
                <span>Total</span>
                <span>{formatCurrency(orderTotal)}</span>
              </div>

              <div className="text-xs text-ocean-400 space-y-1.5 pt-2 border-t border-ocean-100 dark:border-ocean-800">
                <p>🔒 Secure Razorpay checkout</p>
                <p>🚚 Delivery in 24-48 hrs (Delhi NCR)</p>
                <p>❄️ Temperature-controlled packaging</p>
                <p>📞 Support: +91 9999123242</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
