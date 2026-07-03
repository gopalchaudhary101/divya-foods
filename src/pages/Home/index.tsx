import React from 'react'
import { Link } from 'react-router-dom'
import { PageSEO } from '@/components/shared/PageSEO'
import { motion } from 'framer-motion'
import {
  Truck, ShieldCheck, Star, Phone, MessageCircle,
  Clock, ChevronRight, Snowflake, Globe, Award,
} from 'lucide-react'
import OceanBackground from '@/components/shared/OceanBackground'

// ─── JSON-LD structured data ──────────────────────────────────────────────────

const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Divya Foods',
  url: 'https://divya-foods.vercel.app',
  logo: 'https://divya-foods.vercel.app/icons/icon-512.png',
  description: "Delhi NCR's premium imported seafood and Japanese grocery marketplace",
  contactPoint: [{
    '@type': 'ContactPoint',
    telephone: '+91-9999123242',
    contactType: 'sales',
    availableLanguage: ['English', 'Hindi'],
  }],
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'O-52, Saurabh Vihar, Jaitpur, Badarpur Extension',
    addressLocality: 'New Delhi',
    postalCode: '110044',
    addressCountry: 'IN',
  },
}

const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Divya Foods',
  url: 'https://divya-foods.vercel.app',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://divya-foods.vercel.app/products?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}
import { ProductCard } from '@/components/shared/ProductCard'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'
import { useFeaturedProducts, useBestSellers } from '@/hooks/useProducts'
import { RECIPES } from '@/data/recipes'

// ─── Animation helper ─────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

// ─── Benefits strip ───────────────────────────────────────────────────────────

const PERKS = [
  { icon: <Truck size={20} />,      title: 'Same-Day Delivery', sub: 'Order before 2 PM in Delhi' },
  { icon: <Snowflake size={20} />,  title: 'Fresh-Frozen',      sub: 'Cold-chain preserved at source' },
  { icon: <Globe size={20} />,      title: 'Premium Imports',   sub: 'Norwegian, Japanese & more' },
  { icon: <ShieldCheck size={20} />,title: 'Quality Guarantee', sub: 'Replacement if not satisfied' },
]

function BenefitsStrip() {
  return (
    <div className="bg-ocean-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {PERKS.map(p => (
          <div key={p.title} className="flex items-start gap-3">
            <div className="text-gold-400 mt-0.5 shrink-0">{p.icon}</div>
            <div>
              <p className="text-sm font-semibold leading-tight">{p.title}</p>
              <p className="text-xs text-ocean-300 mt-0.5">{p.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Category grid ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { emoji: '🐟', name: 'Salmon',           q: 'salmon' },
  { emoji: '🍤', name: 'Prawns',           q: 'prawns' },
  { emoji: '🐠', name: 'Tuna',             q: 'tuna' },
  { emoji: '🦑', name: 'Squid',            q: 'squid' },
  { emoji: '🦀', name: 'Crab',             q: 'crab' },
  { emoji: '🦞', name: 'Lobster',          q: 'lobster' },
  { emoji: '🐙', name: 'Octopus',          q: 'octopus' },
  { emoji: '🍱', name: 'Japanese Grocery', q: 'japanese' },
]

function CategoryGrid() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-10 px-4 bg-white dark:bg-ocean-950"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-ocean-900 dark:text-white">
            Shop by Category
          </h2>
          <Link to={ROUTES.PRODUCTS} className="text-xs text-ocean-500 hover:text-ocean-700 dark:hover:text-ocean-300 flex items-center gap-1">
            All products <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.q}
              to={`${ROUTES.PRODUCTS}?search=${cat.q}`}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-ocean-50 dark:bg-ocean-900 hover:bg-ocean-100 dark:hover:bg-ocean-800 transition-colors group"
            >
              <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform duration-200">
                {cat.emoji}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-ocean-700 dark:text-ocean-300 text-center leading-tight">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Product section (featured / best sellers) ────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 overflow-hidden animate-pulse">
      <div className="aspect-square bg-ocean-100 dark:bg-ocean-800" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-ocean-100 dark:bg-ocean-800 rounded w-3/4" />
        <div className="h-3 bg-ocean-100 dark:bg-ocean-800 rounded w-1/2" />
        <div className="h-8 bg-ocean-100 dark:bg-ocean-800 rounded-lg mt-3" />
      </div>
    </div>
  )
}

interface ProductSectionProps {
  title: string
  subtitle?: string
  products: ReturnType<typeof useFeaturedProducts>['data']
  isLoading: boolean
  bg?: 'white' | 'tinted'
}

function ProductSection({ title, subtitle, products, isLoading, bg = 'white' }: ProductSectionProps) {
  if (!isLoading && (!products || products.length === 0)) return null

  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className={`py-10 px-4 ${bg === 'tinted' ? 'bg-ocean-50 dark:bg-ocean-900/50' : 'bg-white dark:bg-ocean-950'}`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-ocean-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-ocean-500 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <Link to={ROUTES.PRODUCTS} className="text-xs text-ocean-500 hover:text-ocean-700 dark:hover:text-ocean-300 flex items-center gap-1">
            View all <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
            : products!.slice(0, 8).map(p => <ProductCard key={p.id} product={p} />)
          }
        </div>
      </div>
    </motion.section>
  )
}

// ─── Why choose us ────────────────────────────────────────────────────────────

const WHY = [
  {
    icon: '🌊',
    title: 'Source-Fresh Imports',
    text: 'We import directly from Norway, Japan, and South East Asia. Every product is frozen at peak freshness, not as an afterthought.',
  },
  {
    icon: '🚚',
    title: 'Delhi NCR Delivery',
    text: 'Same-day delivery across Delhi, and next-day to Gurgaon, Noida, and Greater Noida — in insulated packaging, every time.',
  },
  {
    icon: '⭐',
    title: 'Quality You Can Trust',
    text: 'Not happy? We replace it or refund you — no questions asked within 24 hours. That\'s our promise on every order.',
  },
]

function WhyChooseUs() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-12 px-4 bg-ocean-900 text-white"
    >
      <div className="max-w-6xl mx-auto">
        <p className="text-gold-400 text-xs font-bold uppercase tracking-widest text-center mb-2">Why Divya Foods</p>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-center mb-8">Premium Seafood, Delivered Right</h2>

        <div className="grid sm:grid-cols-3 gap-6">
          {WHY.map(w => (
            <div key={w.title} className="text-center">
              <span className="text-4xl">{w.icon}</span>
              <h3 className="font-semibold text-base mt-3 mb-2">{w.title}</h3>
              <p className="text-ocean-300 text-sm leading-relaxed">{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Recipes teaser ───────────────────────────────────────────────────────────

function RecipesTeaser() {
  const preview = RECIPES.slice(0, 3)

  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-12 px-4 bg-white dark:bg-ocean-950"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="text-gold-500 text-xs font-bold uppercase tracking-widest mb-1">Cooking Ideas</p>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-ocean-900 dark:text-white">
              Recipes to Inspire You
            </h2>
          </div>
          <Link to={ROUTES.RECIPES} className="text-xs text-ocean-500 hover:text-ocean-700 dark:hover:text-ocean-300 flex items-center gap-1">
            All recipes <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {preview.map(r => (
            <Link
              key={r.id}
              to={ROUTES.RECIPES}
              className="group bg-ocean-50 dark:bg-ocean-900 rounded-2xl p-5 border border-ocean-100 dark:border-ocean-800 hover:border-ocean-300 dark:hover:border-ocean-600 transition-all hover:shadow-md"
            >
              <div className="text-4xl mb-3">{r.emoji}</div>
              <h3 className="font-semibold text-ocean-900 dark:text-white text-sm mb-1">{r.name}</h3>
              <p className="text-xs text-ocean-500 dark:text-ocean-400 line-clamp-2 mb-3">{r.description}</p>
              <div className="flex items-center gap-3 text-xs text-ocean-400">
                <span className="flex items-center gap-1"><Clock size={11} />{r.time}</span>
                <span className="capitalize">{r.difficulty}</span>
              </div>
              <div className="mt-3 text-xs font-medium text-ocean-600 dark:text-ocean-400 group-hover:text-ocean-900 dark:group-hover:text-white transition-colors flex items-center gap-1">
                See recipe <ChevronRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Delivery info strip ──────────────────────────────────────────────────────

const AREAS = [
  { city: 'Delhi',          flag: '🏙️', timing: 'Same-day (order before 2 PM)' },
  { city: 'Gurgaon',        flag: '🏢', timing: 'Within 24 hours' },
  { city: 'Noida',          flag: '🌆', timing: 'Within 24 hours' },
  { city: 'Greater Noida',  flag: '🌇', timing: 'Within 24 hours' },
  { city: 'Faridabad',      flag: '🏭', timing: 'Within 24 hours' },
]

function DeliveryBanner() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-10 px-4 bg-ocean-50 dark:bg-ocean-900/50 border-y border-ocean-100 dark:border-ocean-800"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="sm:w-48 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <Truck size={18} className="text-ocean-600 dark:text-ocean-400" />
              <h2 className="font-display font-bold text-ocean-900 dark:text-white text-base">We Deliver To</h2>
            </div>
            <p className="text-xs text-ocean-500">Free delivery on orders above {CONFIG.DELIVERY.FREE_DELIVERY_ABOVE ? `₹${CONFIG.DELIVERY.FREE_DELIVERY_ABOVE}` : '₹999'}</p>
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {AREAS.map(a => (
              <div key={a.city} className="bg-white dark:bg-ocean-900 rounded-xl p-3 border border-ocean-100 dark:border-ocean-800 text-center">
                <span className="text-xl">{a.flag}</span>
                <p className="text-xs font-semibold text-ocean-800 dark:text-ocean-200 mt-1">{a.city}</p>
                <p className="text-[10px] text-ocean-400 mt-0.5 leading-tight">{a.timing}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

// ─── Testimonials / stats strip ───────────────────────────────────────────────

const STATS = [
  { value: '500+', label: 'Happy Customers' },
  { value: '50+',  label: 'Premium Products' },
  { value: '24h',  label: 'NCR Delivery' },
  { value: '100%', label: 'Quality Promise' },
]

function StatsStrip() {
  return (
    <motion.div
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="bg-white dark:bg-ocean-950 border-t border-ocean-100 dark:border-ocean-800 py-8 px-4"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
        {STATS.map(s => (
          <div key={s.label}>
            <p className="text-2xl sm:text-3xl font-display font-bold text-ocean-800 dark:text-white">{s.value}</p>
            <p className="text-xs text-ocean-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Contact CTA ──────────────────────────────────────────────────────────────

function ContactCTA() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-12 px-4 bg-gradient-to-br from-ocean-900 to-ocean-700 text-white text-center"
    >
      <div className="max-w-xl mx-auto">
        <Star size={28} className="text-gold-400 mx-auto mb-3" />
        <h2 className="text-xl sm:text-2xl font-display font-bold mb-2">Ready to Order?</h2>
        <p className="text-ocean-200 text-sm mb-6">
          Questions? Our team is available Mon–Sat 9 AM–7 PM, Sunday 10 AM–5 PM.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to={ROUTES.PRODUCTS}
            className="px-6 py-2.5 bg-gold-500 hover:bg-gold-400 text-ocean-900 font-semibold rounded-full text-sm transition-colors"
          >
            Shop Now
          </Link>
          <a
            href={`https://wa.me/${CONFIG.CONTACT.WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full text-sm transition-colors flex items-center gap-2"
          >
            <MessageCircle size={15} /> WhatsApp Us
          </a>
          <a
            href={`tel:${CONFIG.CONTACT.PHONE_1}`}
            className="px-6 py-2.5 border border-white/30 hover:bg-white/10 text-white font-semibold rounded-full text-sm transition-colors flex items-center gap-2"
          >
            <Phone size={15} /> {CONFIG.CONTACT.PHONE_1}
          </a>
        </div>
      </div>
    </motion.section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const HomePage: React.FC = () => {
  const { data: featured, isLoading: loadingFeatured } = useFeaturedProducts()
  const { data: bestSellers, isLoading: loadingBest } = useBestSellers()

  return (
    <>
      <PageSEO
        title="Divya Foods — Premium Imported Seafood & Japanese Grocery, Delhi NCR"
        description="Delhi NCR's finest imported seafood — Norwegian Salmon, Tiger Prawns, Bluefin Tuna, Lobster & authentic Japanese pantry ingredients. Same-day delivery across Delhi, Gurgaon, Noida."
      >
        <script type="application/ld+json">{JSON.stringify(ORG_LD)}</script>
        <script type="application/ld+json">{JSON.stringify(WEBSITE_LD)}</script>
      </PageSEO>

      {/* ── Hero ─────────────────────────────────────────── */}
      {/* IMPORTANT: hero code is preserved exactly as originally written */}
      <div className="min-h-screen relative">
        <OceanBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white px-4">
          <p className="text-gold-400 text-sm font-semibold tracking-widest uppercase mb-4">
            New Delhi's Premium Import Store
          </p>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-center leading-tight">
            Divya Foods
          </h1>
          <p className="mt-4 text-xl text-ocean-100 text-center max-w-2xl">
            {CONFIG.TAGLINE}
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link
              to={ROUTES.PRODUCTS}
              className="px-8 py-3 bg-gold-500 text-ocean-900 font-semibold rounded-full hover:bg-gold-400 transition-colors"
            >
              Shop Now
            </Link>
            <Link
              to={ROUTES.PRODUCTS}
              className="px-8 py-3 border border-white/50 text-white rounded-full hover:bg-white/10 transition-colors"
            >
              Explore Categories
            </Link>
          </div>
          <div className="mt-20 text-center text-ocean-300 text-sm">
            <p>Delivering across {CONFIG.DELIVERY.AREAS.join(' · ')}</p>
          </div>
        </div>
      </div>

      {/* ── Sections added below hero ─────────────────────── */}
      <BenefitsStrip />
      <CategoryGrid />

      <ProductSection
        title="Featured Products"
        subtitle="Hand-picked premium selections"
        products={featured}
        isLoading={loadingFeatured}
      />

      <WhyChooseUs />

      <ProductSection
        title="Best Sellers"
        subtitle="Most loved by our customers"
        products={bestSellers}
        isLoading={loadingBest}
        bg="tinted"
      />

      <RecipesTeaser />
      <DeliveryBanner />
      <StatsStrip />
      <ContactCTA />
    </>
  )
}

export default HomePage
