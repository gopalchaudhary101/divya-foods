import React from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Phone, Mail, MapPin, Truck, Snowflake, ShieldCheck, Zap, ChefHat, CreditCard } from 'lucide-react'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'
import { settingsApi } from '@/services/api/settingsApi'

const year = new Date().getFullYear()

export default function Footer() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60 * 60 * 1000, // legal info changes rarely — cache for an hour
  })

  return (
    <footer className="bg-premium-navy text-premium-cream/90">
      {/* ── Trust badges ─────────────────────────────────── */}
      <div className="border-b border-premium-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { icon: Snowflake, label: 'Cold-Chain Fresh' },
            { icon: ShieldCheck, label: 'Secure Razorpay Payment' },
            { icon: Zap, label: 'Express Delivery' },
            { icon: ChefHat, label: 'Chef-Grade Quality' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon size={22} className="shrink-0 text-premium-teal" />
              <span className="text-xs sm:text-sm font-medium text-premium-cream/80">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* ── Brand ───────────────────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <p className="font-display text-2xl font-semibold text-white">{CONFIG.APP_NAME}</p>
          <p className="text-sm text-premium-muted leading-relaxed">{CONFIG.TAGLINE}</p>
          <div className="flex items-center gap-2 text-sm text-premium-teal">
            <Truck size={15} className="shrink-0" />
            <span>Free delivery above ₹{CONFIG.DELIVERY.FREE_DELIVERY_ABOVE.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* ── Quick Links ─────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="df-eyebrow mb-1">
            Quick Links
          </p>
          {[
            { label: 'All Products', to: ROUTES.PRODUCTS },
            { label: 'My Cart', to: ROUTES.CART },
            { label: 'My Orders', to: ROUTES.ORDERS },
            { label: 'Track Order', to: ROUTES.TRACK_ORDER },
            { label: 'Bulk / Wholesale Orders', to: ROUTES.BULK_ORDER },
            { label: 'Business Solutions', to: ROUTES.BUSINESS_SOLUTIONS },
            { label: 'My Account', to: ROUTES.PROFILE },
            { label: 'About Us', to: ROUTES.ABOUT },
            { label: 'Login', to: ROUTES.AUTH.LOGIN },
          ].map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-sm text-premium-muted hover:text-premium-gold transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* ── Delivery Areas ──────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="df-eyebrow mb-1">
            We Deliver To
          </p>
          {CONFIG.DELIVERY.AREAS.map((area) => (
            <span key={area} className="text-sm text-premium-muted">
              {area}
            </span>
          ))}
          <div className="mt-2 text-xs text-premium-muted/70 space-y-0.5">
            <p>Min. order: ₹{CONFIG.DELIVERY.MIN_ORDER_AMOUNT}</p>
            <p>Delivery charge: ₹{CONFIG.DELIVERY.STANDARD_CHARGE}</p>
          </div>
        </div>

        {/* ── Contact ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="df-eyebrow mb-1">
            Contact Us
          </p>
          <a
            href={`tel:${CONFIG.CONTACT.PHONE_1.replace(/\s/g, '')}`}
            className="flex items-start gap-2.5 text-sm text-premium-muted hover:text-premium-gold transition-colors"
          >
            <Phone size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.PHONE_1}
          </a>
          <a
            href={`tel:${CONFIG.CONTACT.PHONE_2.replace(/\s/g, '')}`}
            className="flex items-start gap-2.5 text-sm text-premium-muted hover:text-premium-gold transition-colors"
          >
            <Phone size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.PHONE_2}
          </a>
          <a
            href={`mailto:${CONFIG.CONTACT.EMAIL}`}
            className="flex items-start gap-2.5 text-sm text-premium-muted hover:text-premium-gold transition-colors break-all"
          >
            <Mail size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.EMAIL}
          </a>
          <p className="flex items-start gap-2.5 text-sm text-premium-muted">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.ADDRESS}
          </p>
        </div>
      </div>

      {/* ── Payment methods ──────────────────────────────── */}
      <div className="border-t border-premium-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="df-eyebrow">We Accept</p>
          <div className="flex items-center gap-4 text-premium-muted text-xs">
            <span className="flex items-center gap-1.5"><CreditCard size={16} /> Cards</span>
            <span>UPI</span>
            <span>Net Banking</span>
            <span>Razorpay Secure</span>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-premium-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3 text-xs text-premium-muted/70">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© {year} {CONFIG.APP_NAME}. All rights reserved.</p>
            <p>Serving premium seafood & gourmet goods across Delhi NCR</p>
          </div>
          {settings && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-4 text-center text-premium-muted/50 border-t border-premium-charcoal/60 pt-3">
              <span>FSSAI Lic. No.: {settings.fssaiNumber}</span>
              <span className="hidden sm:inline">•</span>
              <span>GSTIN: {settings.gstNumber}</span>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
