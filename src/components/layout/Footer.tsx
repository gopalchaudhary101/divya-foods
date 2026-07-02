import React from 'react'
import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Truck } from 'lucide-react'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'

const year = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="bg-ocean-900 text-ocean-100">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* ── Brand ───────────────────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <p className="font-display text-2xl font-semibold text-white">{CONFIG.APP_NAME}</p>
          <p className="text-sm text-ocean-300 leading-relaxed">{CONFIG.TAGLINE}</p>
          <div className="flex items-center gap-2 text-sm text-mint-400">
            <Truck size={15} className="shrink-0" />
            <span>Free delivery above ₹{CONFIG.DELIVERY.FREE_DELIVERY_ABOVE.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* ── Quick Links ─────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-1">
            Quick Links
          </p>
          {[
            { label: 'All Products', to: ROUTES.PRODUCTS },
            { label: 'My Cart', to: ROUTES.CART },
            { label: 'My Orders', to: ROUTES.ORDERS },
            { label: 'My Account', to: ROUTES.PROFILE },
            { label: 'Login', to: ROUTES.AUTH.LOGIN },
          ].map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-sm text-ocean-300 hover:text-gold-400 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* ── Delivery Areas ──────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-1">
            We Deliver To
          </p>
          {CONFIG.DELIVERY.AREAS.map((area) => (
            <span key={area} className="text-sm text-ocean-300">
              {area}
            </span>
          ))}
          <div className="mt-2 text-xs text-ocean-400 space-y-0.5">
            <p>Min. order: ₹{CONFIG.DELIVERY.MIN_ORDER_AMOUNT}</p>
            <p>Delivery charge: ₹{CONFIG.DELIVERY.STANDARD_CHARGE}</p>
          </div>
        </div>

        {/* ── Contact ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-1">
            Contact Us
          </p>
          <a
            href={`tel:${CONFIG.CONTACT.PHONE_1.replace(/\s/g, '')}`}
            className="flex items-start gap-2.5 text-sm text-ocean-300 hover:text-gold-400 transition-colors"
          >
            <Phone size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.PHONE_1}
          </a>
          <a
            href={`tel:${CONFIG.CONTACT.PHONE_2.replace(/\s/g, '')}`}
            className="flex items-start gap-2.5 text-sm text-ocean-300 hover:text-gold-400 transition-colors"
          >
            <Phone size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.PHONE_2}
          </a>
          <a
            href={`mailto:${CONFIG.CONTACT.EMAIL}`}
            className="flex items-start gap-2.5 text-sm text-ocean-300 hover:text-gold-400 transition-colors break-all"
          >
            <Mail size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.EMAIL}
          </a>
          <p className="flex items-start gap-2.5 text-sm text-ocean-300">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            {CONFIG.CONTACT.ADDRESS}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-ocean-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ocean-500">
          <p>© {year} {CONFIG.APP_NAME}. All rights reserved.</p>
          <p>Serving premium seafood & gourmet goods across Delhi NCR</p>
        </div>
      </div>
    </footer>
  )
}
