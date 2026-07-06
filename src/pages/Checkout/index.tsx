import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { MapPin, ShoppingBag, CreditCard, ChevronRight, Tag, Truck, Shield, CheckCircle, X, Zap, CalendarClock, LogIn, UserCircle2, Gift } from 'lucide-react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { clearCart } from '@/features/cart/cartSlice'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/utils/formatCurrency'
import { orderApi, type DeliverySlot } from '@/services/api/orderApi'
import { couponApi } from '@/services/api/couponApi'
import { settingsApi } from '@/services/api/settingsApi'
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

const TIME_WINDOWS = ['8am - 12pm', '12pm - 5pm', '5pm - 9pm'] as const

function tomorrowIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

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
  const [coupon, setCoupon]           = useState((location.state as { couponCode?: string })?.couponCode ?? '')
  const [couponApplied, setCouponApplied] = useState(false)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponMsg, setCouponMsg]     = useState('')
  const [couponValid, setCouponValid] = useState(false)
  const [discount, setDiscount]       = useState(0)
  const [giftCardCode, setGiftCardCode] = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState('')

  // Delivery slot — express (default, fastest dispatch) or a scheduled date + time window
  const [slotType, setSlotType]       = useState<'express' | 'scheduled'>('express')
  const [scheduledDate, setScheduledDate] = useState(tomorrowIso())
  const [scheduledWindow, setScheduledWindow] = useState<string>(TIME_WINDOWS[0])

  // Guest checkout — unauthenticated visitors choose to log in or continue without an account
  const [checkoutAs, setCheckoutAs]   = useState<'account' | 'guest' | null>(isAuthenticated ? 'account' : null)
  const [guestEmail, setGuestEmail]   = useState('')
  const [guestConfirmation, setGuestConfirmation] = useState<{ orderNumber: string; email: string } | null>(null)

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

  // Redirect only once cart is empty, or once the visitor has chosen how to check out.
  // Unauthenticated visitors first see a "Log in / Continue as guest" choice instead of
  // being bounced straight to the login page.
  useEffect(() => {
    if (items.length === 0 && !guestConfirmation) { navigate(ROUTES.CART) }
  }, [items.length, navigate, guestConfirmation])

  // Pre-load Razorpay script in the background
  useEffect(() => { loadRazorpayScript() }, [])

  const { data: siteSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60 * 60 * 1000,
  })

  // ── Step 1: address form submit ───────────────────────────────────────────
  function onAddressSubmit() {
    if (checkoutAs === 'guest' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      setError('Enter a valid email address to continue.')
      return
    }
    setError('')
    setStep(1)
  }

  // ── Apply coupon ──────────────────────────────────────────────────────────
  async function handleApplyCoupon() {
    if (!coupon.trim()) return
    setCouponLoading(true)
    setCouponMsg('')
    setCouponValid(false)
    setCouponApplied(false)
    setDiscount(0)
    try {
      const result = await couponApi.validate(coupon.trim(), totalPrice)
      if (result.valid) {
        setDiscount(result.discountAmount)
        setCouponApplied(true)
        setCouponValid(true)
      } else {
        setCouponValid(false)
      }
      setCouponMsg(result.message)
    } catch {
      setCouponMsg('Could not validate coupon. Try again.')
      setCouponValid(false)
    } finally {
      setCouponLoading(false)
    }
  }

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

    const isGuest = checkoutAs === 'guest'
    const deliverySlot: DeliverySlot = slotType === 'express'
      ? { type: 'express' }
      : { type: 'scheduled', date: scheduledDate, timeWindow: scheduledWindow }

    const address = {
      label:        'Delivery',
      fullName:     addr.fullName,
      phone:        addr.phone,
      addressLine1: addr.addressLine1,
      addressLine2: addr.addressLine2,
      city:         addr.city,
      state:        addr.state,
      pincode:      addr.pincode,
    }

    try {
      // Step 1 — create order on backend + get Razorpay order ID
      const initiated = isGuest
        ? await orderApi.initiateGuest(
            { name: addr.fullName, email: guestEmail, phone: addr.phone },
            address, items, couponApplied ? coupon : undefined, undefined, deliverySlot, giftCardCode.trim() || undefined,
          )
        : await orderApi.initiate(
            address, items, couponApplied ? coupon : undefined, undefined, deliverySlot, giftCardCode.trim() || undefined,
          )

      // A gift card can cover the entire order — no payment gateway needed at all.
      if (!initiated.razorpayOrderId) {
        dispatch(clearCart())
        if (isGuest) {
          setGuestConfirmation({ orderNumber: initiated.orderNumber, email: guestEmail })
        } else {
          navigate(`/orders/${initiated.orderId}`, { state: { justOrdered: true } })
        }
        return
      }

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
          email:   isGuest ? guestEmail : (user?.email ?? ''),
          contact: addr.phone,
        },
        theme: { color: '#C9A227' },
        handler: async (response) => {
          // Step 3 — verify payment signature on backend
          try {
            if (isGuest) {
              await orderApi.verifyGuestPayment(
                initiated.orderId, guestEmail,
                response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature,
              )
              dispatch(clearCart())
              setGuestConfirmation({ orderNumber: initiated.orderNumber, email: guestEmail })
            } else {
              await orderApi.verifyPayment(
                initiated.orderId,
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature,
              )
              // Clear Redux cart after confirmed payment
              dispatch(clearCart())
              navigate(`/orders/${initiated.orderId}`, { state: { justOrdered: true } })
            }
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
                ${i < step ? 'bg-premium-teal text-white' : i === step ? 'bg-premium-gold text-premium-navy' : 'bg-premium-navy/10 dark:bg-ocean-800 text-premium-navy/40'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${i === step ? 'text-premium-navy dark:text-ocean-200 font-semibold' : 'text-premium-navy/40'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-16 mb-4 mx-1 transition-colors ${i < step ? 'bg-premium-teal' : 'bg-premium-navy/10 dark:bg-ocean-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  // Guest order confirmed — show a standalone success screen (no login exists to view /orders/:id)
  if (guestConfirmation) {
    return (
      <>
        <Helmet><title>Order Confirmed — Divya Foods</title></Helmet>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <CheckCircle size={56} className="mx-auto text-premium-teal mb-5" />
          <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-2">Order Confirmed!</h1>
          <p className="text-premium-navy/60 mb-1">
            Thank you! Your order <strong className="text-premium-navy dark:text-ocean-100">{guestConfirmation.orderNumber}</strong> has been placed.
          </p>
          <p className="text-sm text-premium-navy/40 mb-8">
            A confirmation has been sent to {guestConfirmation.email}. Since you checked out as a guest, use the order number and this email to track your order anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={ROUTES.TRACK_ORDER} className="inline-flex items-center justify-center gap-2 border border-premium-navy/20 dark:border-ocean-700 text-premium-navy dark:text-ocean-200 px-6 py-3 rounded-xl font-medium hover:bg-premium-navy/5 dark:hover:bg-ocean-800 transition-colors">
              Track Your Order
            </Link>
            <Link to={ROUTES.PRODUCTS} className="inline-flex items-center justify-center gap-2 bg-premium-gold hover:bg-premium-gold-light text-premium-navy px-6 py-3 rounded-xl font-medium transition-colors">
              Continue Shopping
            </Link>
          </div>
        </div>
      </>
    )
  }

  // Unauthenticated visitor hasn't chosen how to check out yet
  if (!isAuthenticated && checkoutAs === null) {
    return (
      <>
        <Helmet><title>Checkout — Divya Foods</title></Helmet>
        <div className="max-w-md mx-auto px-4 py-16">
          <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-2 text-center">
            How would you like to check out?
          </h1>
          <p className="text-sm text-premium-navy/40 text-center mb-8">
            You can place your order without creating an account.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(ROUTES.AUTH.LOGIN, { state: { from: ROUTES.CHECKOUT } })}
              className="flex items-center gap-3 w-full text-left bg-white dark:bg-ocean-900 border-2 border-premium-navy/10 dark:border-ocean-800 hover:border-premium-gold rounded-2xl p-5 transition-colors"
            >
              <LogIn size={22} className="text-premium-teal shrink-0" />
              <div>
                <p className="font-semibold text-premium-navy dark:text-white">Log In</p>
                <p className="text-xs text-premium-navy/40">Track orders, save addresses, and earn loyalty points.</p>
              </div>
            </button>
            <button
              onClick={() => setCheckoutAs('guest')}
              className="flex items-center gap-3 w-full text-left bg-white dark:bg-ocean-900 border-2 border-premium-navy/10 dark:border-ocean-800 hover:border-premium-gold rounded-2xl p-5 transition-colors"
            >
              <UserCircle2 size={22} className="text-premium-teal shrink-0" />
              <div>
                <p className="font-semibold text-premium-navy dark:text-white">Continue as Guest</p>
                <p className="text-xs text-premium-navy/40">Quick checkout — just your delivery details and email.</p>
              </div>
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet><title>Checkout — Divya Foods</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <h1 className="font-display text-2xl font-semibold text-premium-navy dark:text-white mb-6 text-center">
          Secure Checkout
        </h1>
        <StepIndicator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left panel ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">

            {/* STEP 0 — Delivery address */}
            {step === 0 && (
              <form onSubmit={handleSubmit(onAddressSubmit)} className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold text-premium-navy dark:text-white mb-5 flex items-center gap-2">
                  <MapPin size={18} className="text-premium-teal" />
                  Delivery Address
                </h2>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Full Name *</label>
                    <input {...register('fullName', { required: 'Required' })}
                      className="df-input w-full" placeholder="Raj Kumar" />
                    {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
                  </div>

                  {checkoutAs === 'guest' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        className="df-input w-full" placeholder="you@example.com"
                      />
                      <p className="text-xs text-premium-navy/40 mt-1">Used to send your order confirmation and to track your order.</p>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Phone *</label>
                    <input {...register('phone', { required: 'Required', pattern: { value: /^[0-9+]{10,13}$/, message: 'Enter a valid phone number' } })}
                      type="tel" className="df-input w-full" placeholder="+91 9999123456" />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Address Line 1 *</label>
                    <input {...register('addressLine1', { required: 'Required', minLength: { value: 5, message: 'Too short' } })}
                      className="df-input w-full" placeholder="House No., Street, Colony" />
                    {errors.addressLine1 && <p className="text-xs text-red-500 mt-1">{errors.addressLine1.message}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Address Line 2</label>
                    <input {...register('addressLine2')}
                      className="df-input w-full" placeholder="Landmark, Area (optional)" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">City *</label>
                    <input {...register('city', { required: 'Required' })}
                      className="df-input w-full" placeholder="New Delhi" />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">State *</label>
                    <input {...register('state', { required: 'Required' })}
                      className="df-input w-full" placeholder="Delhi" />
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state.message}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-1">Pincode *</label>
                    <input {...register('pincode', { required: 'Required', pattern: { value: /^[0-9]{6}$/, message: '6-digit pincode required' } })}
                      className="df-input w-full" placeholder="110044" maxLength={6} />
                    {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode.message}</p>}
                  </div>
                </div>

                <p className="text-xs text-premium-navy/40 mt-4 flex items-center gap-1.5">
                  <Truck size={13} />
                  We deliver to Delhi NCR, Gurgaon, Noida and Greater Noida
                </p>

                {/* Delivery slot — express dispatch or schedule for later */}
                <div className="mt-5">
                  <label className="block text-xs font-semibold text-premium-navy/50 uppercase tracking-widest mb-2">
                    Delivery Slot
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSlotType('express')}
                      className={[
                        'text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all flex items-start gap-2',
                        slotType === 'express'
                          ? 'border-premium-gold bg-premium-gold/10 text-premium-navy dark:text-white'
                          : 'border-premium-navy/10 dark:border-ocean-700 text-premium-navy/60 dark:text-ocean-300 hover:border-premium-gold/50',
                      ].join(' ')}
                    >
                      <Zap size={14} className="mt-0.5 shrink-0" />
                      <span>
                        <p className="font-semibold text-xs">Express</p>
                        <p className="text-[10px] opacity-70 mt-0.5">Fastest dispatch (24–48 hrs)</p>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlotType('scheduled')}
                      className={[
                        'text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all flex items-start gap-2',
                        slotType === 'scheduled'
                          ? 'border-premium-gold bg-premium-gold/10 text-premium-navy dark:text-white'
                          : 'border-premium-navy/10 dark:border-ocean-700 text-premium-navy/60 dark:text-ocean-300 hover:border-premium-gold/50',
                      ].join(' ')}
                    >
                      <CalendarClock size={14} className="mt-0.5 shrink-0" />
                      <span>
                        <p className="font-semibold text-xs">Schedule for Later</p>
                        <p className="text-[10px] opacity-70 mt-0.5">Pick a date & time window</p>
                      </span>
                    </button>
                  </div>

                  {slotType === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-premium-navy/40 uppercase tracking-widest mb-1">Date</label>
                        <input
                          type="date"
                          min={tomorrowIso()}
                          value={scheduledDate}
                          onChange={e => setScheduledDate(e.target.value)}
                          className="df-input w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-premium-navy/40 uppercase tracking-widest mb-1">Time Window</label>
                        <select
                          value={scheduledWindow}
                          onChange={e => setScheduledWindow(e.target.value)}
                          className="df-input w-full text-sm"
                        >
                          {TIME_WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" variant="premium" size="lg" className="w-full mt-6" rightIcon={<ChevronRight size={16} />}>
                  Continue to Review
                </Button>
              </form>
            )}

            {/* STEP 1 — Review order */}
            {step === 1 && (
              <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold text-premium-navy dark:text-white mb-5 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-premium-teal" />
                  Review Your Order
                </h2>

                {/* Address preview */}
                <div className="bg-premium-navy/5 dark:bg-ocean-800 rounded-xl p-4 mb-5">
                  <p className="df-eyebrow mb-1">Delivering to</p>
                  {(() => { const v = getValues(); return (
                    <p className="text-sm text-premium-navy dark:text-ocean-100">
                      {v.fullName} · {v.phone}<br />
                      {v.addressLine1}{v.addressLine2 ? `, ${v.addressLine2}` : ''}<br />
                      {v.city}, {v.state} — {v.pincode}
                    </p>
                  )})()}
                  <p className="text-xs text-premium-navy/50 mt-1">
                    {slotType === 'express'
                      ? 'Slot: Express delivery (fastest dispatch)'
                      : `Slot: ${scheduledDate} · ${scheduledWindow}`}
                  </p>
                  <button onClick={() => setStep(0)} className="text-xs text-premium-teal hover:text-premium-gold mt-1">
                    Change address
                  </button>
                </div>

                {/* Items */}
                <div className="divide-y divide-premium-navy/10 dark:divide-ocean-800 mb-5">
                  {items.map(item => (
                    <div key={item.productId} className="flex gap-3 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-premium-navy/5 dark:bg-ocean-800">
                        {item.image
                          ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={16} className="text-premium-navy/30" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-premium-navy dark:text-white line-clamp-1">{item.name}</p>
                        <p className="text-xs text-premium-navy/40">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                      </div>
                      <span className="text-sm font-semibold text-premium-gold shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                <div className="mb-5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-premium-navy/40" />
                      <input
                        value={coupon}
                        onChange={e => {
                          setCoupon(e.target.value.toUpperCase())
                          setCouponApplied(false)
                          setCouponValid(false)
                          setCouponMsg('')
                          setDiscount(0)
                        }}
                        onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                        placeholder="COUPON CODE"
                        className={`df-input w-full pl-8 pr-7 text-sm ${couponValid ? 'border-premium-teal' : couponMsg && !couponValid ? 'border-red-400' : ''}`}
                      />
                      {couponApplied && (
                        <button
                          type="button"
                          onClick={() => { setCoupon(''); setCouponApplied(false); setCouponValid(false); setCouponMsg(''); setDiscount(0) }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-premium-navy/40 hover:text-red-500"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <Button
                      variant="premiumOutline" size="sm"
                      loading={couponLoading}
                      disabled={!coupon.trim() || couponApplied}
                      onClick={handleApplyCoupon}
                    >
                      {couponApplied ? 'Applied' : 'Apply'}
                    </Button>
                  </div>
                  {couponMsg && (
                    <p className={`text-xs mt-1.5 flex items-center gap-1 ${couponValid ? 'text-premium-teal' : 'text-red-500'}`}>
                      {couponValid ? <CheckCircle size={11} /> : null}
                      {couponMsg}
                    </p>
                  )}
                </div>

                {/* Gift card — applied server-side when payment is initiated; no separate preview step */}
                <div className="mb-5">
                  <div className="relative">
                    <Gift size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-premium-navy/40" />
                    <input
                      value={giftCardCode}
                      onChange={e => setGiftCardCode(e.target.value.toUpperCase())}
                      placeholder="GIFT CARD CODE (optional)"
                      className="df-input w-full pl-8 text-sm"
                    />
                  </div>
                  {giftCardCode.trim() && (
                    <p className="text-xs text-premium-navy/40 mt-1.5">
                      Applied automatically when you complete payment.
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="premiumOutline" size="md" className="flex-1" onClick={() => setStep(0)}>Back</Button>
                  <Button variant="premium" size="md" className="flex-1" rightIcon={<ChevronRight size={16} />} onClick={() => setStep(2)}>
                    Proceed to Pay
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2 — Payment */}
            {step === 2 && (
              <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6">
                <h2 className="font-display text-lg font-semibold text-premium-navy dark:text-white mb-5 flex items-center gap-2">
                  <CreditCard size={18} className="text-premium-teal" />
                  Payment
                </h2>

                <div className="bg-premium-navy/5 dark:bg-ocean-800 rounded-xl p-5 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <img src="https://razorpay.com/favicon.png" alt="Razorpay" className="w-5 h-5" />
                    <span className="font-medium text-premium-navy dark:text-white">Razorpay Secure Payment</span>
                  </div>
                  <p className="text-sm text-premium-navy/60">
                    Pay securely using UPI, Net Banking, Credit/Debit Card, or Wallets. Your payment details are encrypted and never stored by us.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm mb-4">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="premiumOutline" size="md" className="flex-1" onClick={() => setStep(1)} disabled={isLoading}>
                    Back
                  </Button>
                  <Button
                    variant="premium" size="lg" className="flex-1"
                    onClick={handlePay}
                    loading={isLoading}
                    leftIcon={<Shield size={16} />}
                  >
                    Pay {formatCurrency(orderTotal)}
                  </Button>
                </div>

                <p className="text-xs text-premium-navy/40 text-center mt-4 flex items-center justify-center gap-1">
                  <Shield size={11} />
                  256-bit SSL encrypted · Powered by Razorpay
                </p>
              </div>
            )}
          </div>

          {/* ── Order summary sidebar ───────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 sticky top-24">
              <h3 className="font-display font-semibold text-premium-navy dark:text-white mb-4">Order Summary</h3>

              <div className="flex flex-col gap-2 text-sm pb-4 border-b border-premium-navy/10 dark:border-ocean-800">
                <div className="flex justify-between text-premium-navy/70 dark:text-ocean-300">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-premium-navy/70 dark:text-ocean-300">
                  <span>Delivery</span>
                  <span className={deliveryCharge === 0 ? 'text-premium-teal font-medium' : ''}>
                    {deliveryCharge === 0 ? 'FREE' : formatCurrency(deliveryCharge)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-premium-teal">
                    <span>Coupon discount</span>
                    <span>−{formatCurrency(discount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-semibold text-premium-navy dark:text-white py-4 text-base">
                <span>Total</span>
                <span className="text-premium-gold">{formatCurrency(orderTotal)}</span>
              </div>

              <div className="text-xs text-premium-navy/40 space-y-1.5 pt-2 border-t border-premium-navy/10 dark:border-ocean-800">
                <p>🔒 Secure Razorpay checkout</p>
                <p>🚚 Delivery in 24-48 hrs (Delhi NCR)</p>
                <p>❄️ Temperature-controlled packaging</p>
                <p>📞 Support: +91 9999123242</p>
                {siteSettings && (
                  <p>FSSAI: {siteSettings.fssaiNumber} · GST: {siteSettings.gstNumber}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
