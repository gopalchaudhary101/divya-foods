import React from 'react'
import { Link } from 'react-router-dom'
import { PageSEO } from '@/components/shared/PageSEO'
import { motion } from 'framer-motion'
import {
  Truck, ShieldCheck, Star, Phone, MessageCircle,
  Clock, ChevronRight, Snowflake, Globe,
  Anchor, PackageCheck, Quote,
} from 'lucide-react'
import PremiumHeroBackground from '@/components/shared/PremiumHeroBackground'
import { AnimatedCounter } from '@/components/shared/AnimatedCounter'

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
import { useRecipes } from '@/hooks/useRecipes'

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
    <div className="bg-premium-navy text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {PERKS.map(p => (
          <div key={p.title} className="flex items-start gap-3">
            <div className="text-premium-gold mt-0.5 shrink-0">{p.icon}</div>
            <div>
              <p className="text-sm font-semibold leading-tight">{p.title}</p>
              <p className="text-xs text-premium-muted mt-0.5">{p.sub}</p>
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
      className="py-14 px-4 bg-premium-cream dark:bg-ocean-950"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <p className="df-eyebrow mb-1">Explore</p>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-premium-navy dark:text-white">
              Shop by Category
            </h2>
          </div>
          <Link to={ROUTES.PRODUCTS} className="text-xs text-premium-teal hover:text-premium-gold dark:hover:text-ocean-300 flex items-center gap-1">
            All products <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.q}
              to={`${ROUTES.PRODUCTS}?search=${cat.q}`}
              className="df-glow-hover flex flex-col items-center gap-2 p-4 rounded-2xl bg-premium-navy border border-transparent group"
            >
              <span className="text-2xl sm:text-4xl group-hover:scale-110 transition-transform duration-300">
                {cat.emoji}
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-premium-cream/90 text-center leading-tight">
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
    <div className="rounded-2xl bg-premium-charcoal border border-white/5 overflow-hidden animate-pulse">
      <div className="aspect-square bg-premium-navy" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-premium-navy rounded w-3/4" />
        <div className="h-3 bg-premium-navy rounded w-1/2" />
        <div className="h-8 bg-premium-navy rounded-lg mt-3" />
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
      className={`py-14 px-4 ${bg === 'tinted' ? 'bg-premium-charcoal' : 'bg-premium-navy'}`}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white">{title}</h2>
            {subtitle && <p className="text-premium-muted text-sm mt-0.5">{subtitle}</p>}
          </div>
          <Link to={ROUTES.PRODUCTS} className="text-xs text-premium-teal hover:text-premium-gold flex items-center gap-1">
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
      className="py-14 px-4 bg-premium-charcoal text-white"
    >
      <div className="max-w-6xl mx-auto">
        <p className="df-eyebrow text-center mb-2 w-full">Why Divya Foods</p>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-center mb-8">Premium Seafood, Delivered Right</h2>

        <div className="grid sm:grid-cols-3 gap-6">
          {WHY.map(w => (
            <div key={w.title} className="text-center">
              <span className="text-4xl">{w.icon}</span>
              <h3 className="font-semibold text-base mt-3 mb-2">{w.title}</h3>
              <p className="text-premium-muted text-sm leading-relaxed">{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Recipes teaser ───────────────────────────────────────────────────────────

function RecipesTeaser() {
  const { data } = useRecipes({ limit: 3 })
  const preview = data?.data ?? []

  if (preview.length === 0) return null

  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-14 px-4 bg-premium-cream dark:bg-ocean-950"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="df-eyebrow mb-1">Cooking Ideas</p>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-premium-navy dark:text-white">
              Recipes to Inspire You
            </h2>
          </div>
          <Link to={ROUTES.RECIPES} className="text-xs text-premium-teal hover:text-premium-gold dark:hover:text-ocean-300 flex items-center gap-1">
            All recipes <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {preview.map(r => (
            <Link
              key={r.id}
              to={ROUTES.RECIPE_DETAIL.replace(':slug', r.slug)}
              className="df-glow-hover group bg-premium-navy rounded-2xl p-5 border border-transparent"
            >
              <div className="text-4xl mb-3">{r.emoji}</div>
              <h3 className="font-semibold text-white text-sm mb-1">{r.title}</h3>
              <p className="text-xs text-premium-muted line-clamp-2 mb-3">{r.description}</p>
              <div className="flex items-center gap-3 text-xs text-premium-muted">
                <span className="flex items-center gap-1"><Clock size={11} />{r.totalTimeMinutes} mins</span>
                <span className="capitalize">{r.difficulty}</span>
              </div>
              <div className="mt-3 text-xs font-medium text-premium-gold group-hover:text-premium-gold-light transition-colors flex items-center gap-1">
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
      className="py-10 px-4 bg-premium-cream dark:bg-ocean-900/50 border-y border-premium-navy/10 dark:border-ocean-800"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="sm:w-48 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <Truck size={18} className="text-premium-teal" />
              <h2 className="font-display font-bold text-premium-navy dark:text-white text-base">We Deliver To</h2>
            </div>
            <p className="text-xs text-premium-navy/60 dark:text-ocean-400">Free delivery on orders above {CONFIG.DELIVERY.FREE_DELIVERY_ABOVE ? `₹${CONFIG.DELIVERY.FREE_DELIVERY_ABOVE}` : '₹999'}</p>
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {AREAS.map(a => (
              <div key={a.city} className="bg-premium-navy rounded-xl p-3 border border-white/5 text-center">
                <span className="text-xl">{a.flag}</span>
                <p className="text-xs font-semibold text-premium-cream/90 mt-1">{a.city}</p>
                <p className="text-[10px] text-premium-muted mt-0.5 leading-tight">{a.timing}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { icon: <Anchor size={26} strokeWidth={1.25} />,       title: 'Source',     text: 'Sourced direct from Norwegian, Japanese & South East Asian suppliers.' },
  { icon: <Snowflake size={26} strokeWidth={1.25} />,    title: 'Cold-Chain', text: 'Frozen at peak freshness and held in cold-chain storage end-to-end.' },
  { icon: <PackageCheck size={26} strokeWidth={1.25} />, title: 'Deliver',    text: 'Packed in insulated boxes and delivered same-day across Delhi NCR.' },
]

function HowItWorks() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-14 px-4 bg-premium-cream dark:bg-ocean-950"
    >
      <div className="max-w-6xl mx-auto">
        <p className="df-eyebrow text-center mb-2 w-full">How It Works</p>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-center text-premium-navy dark:text-white mb-10">
          From Source to Your Doorstep
        </h2>

        <div className="grid sm:grid-cols-3 gap-8 relative">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center relative">
              <div className="w-16 h-16 rounded-full border border-premium-gold/40 flex items-center justify-center text-premium-gold mb-4">
                {step.icon}
              </div>
              <h3 className="font-display font-semibold text-lg text-premium-navy dark:text-white mb-1.5">
                {i + 1}. {step.title}
              </h3>
              <p className="text-sm text-premium-navy/60 dark:text-ocean-400 max-w-xs leading-relaxed">
                {step.text}
              </p>
            </div>
          ))}
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
      className="bg-premium-navy py-12 px-4"
    >
      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
        {STATS.map(s => (
          <div key={s.label}>
            <p className="text-3xl sm:text-4xl font-display font-bold text-premium-gold">
              <AnimatedCounter value={s.value} />
            </p>
            <p className="text-xs text-premium-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
// Placeholder copy — swap in real customer quotes when available.

const TESTIMONIALS = [
  { quote: 'The salmon arrives colder and fresher than anything I’ve found at a premium supermarket. Delivery is always on time.', name: 'Ritu S.', city: 'Gurgaon' },
  { quote: 'Ordered tiger prawns for a dinner party — restaurant quality, and it showed up same-day exactly as promised.', name: 'Arjun M.', city: 'New Delhi' },
  { quote: 'Their Japanese grocery selection is unmatched in NCR. I no longer have to import my own pantry staples.', name: 'Kavita N.', city: 'Noida' },
]

function Testimonials() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-16 px-4 bg-premium-charcoal"
    >
      <div className="max-w-6xl mx-auto">
        <p className="df-eyebrow text-center mb-2 w-full">Testimonials</p>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-center text-white mb-10">
          What Our Customers Say
        </h2>

        <div className="grid sm:grid-cols-3 gap-8">
          {TESTIMONIALS.map(t => (
            <figure key={t.name} className="flex flex-col items-center text-center">
              <Quote size={22} className="text-premium-gold mb-3" />
              <blockquote className="font-display text-lg italic text-premium-cream/90 leading-relaxed mb-4">
                “{t.quote}”
              </blockquote>
              <div className="flex gap-0.5 text-premium-gold mb-2" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
              </div>
              <figcaption className="text-xs text-premium-muted">
                {t.name} · {t.city}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Contact CTA ──────────────────────────────────────────────────────────────

function ContactCTA() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-14 px-4 bg-gradient-to-br from-premium-navy to-[#060F16] text-white text-center"
    >
      <div className="max-w-xl mx-auto">
        <Star size={28} className="text-premium-gold mx-auto mb-3" fill="currentColor" />
        <h2 className="text-xl sm:text-2xl font-display font-bold mb-2">Ready to Order?</h2>
        <p className="text-premium-muted text-sm mb-6">
          Questions? Our team is available Mon–Sat 9 AM–7 PM, Sunday 10 AM–5 PM.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to={ROUTES.PRODUCTS}
            className="px-6 py-2.5 bg-premium-gold hover:bg-premium-gold-light text-premium-navy font-semibold rounded-full text-sm transition-colors"
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
            className="px-6 py-2.5 border border-premium-gold/40 hover:bg-white/10 text-white font-semibold rounded-full text-sm transition-colors flex items-center gap-2"
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
      <div className="min-h-screen relative">
        <PremiumHeroBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white px-4">
          <p className="df-eyebrow mb-5">
            Premium Imported Marketplace — New Delhi
          </p>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-center leading-tight">
            Divya Foods
          </h1>
          <p className="mt-5 font-display italic text-2xl md:text-4xl text-premium-gold text-center max-w-3xl leading-snug">
            Luxury Imported Foods, Delivered Fresh
          </p>
          <p className="mt-4 text-lg text-premium-cream/80 text-center max-w-2xl">
            {CONFIG.TAGLINE}
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <Link
              to={ROUTES.PRODUCTS}
              className="px-8 py-3 bg-premium-gold text-premium-navy font-semibold rounded-full hover:bg-premium-gold-light transition-colors"
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
          <div className="mt-20 text-center text-premium-muted text-sm">
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
      <HowItWorks />

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
      <Testimonials />
      <ContactCTA />
    </>
  )
}

export default HomePage
