import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageSEO } from '@/components/shared/PageSEO'
import {
  Snowflake, Boxes, ClipboardList, Truck, LayoutDashboard, Gift,
  Phone, MessageCircle, ChevronRight, Crown, CheckCircle2,
} from 'lucide-react'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

// Every "solution" here maps to a real, shipped feature — no aspirational copy.
const SOLUTIONS = [
  {
    icon: <Snowflake size={22} />,
    problem: 'Inconsistent cold chain',
    solution: 'Every order ships in temperature-controlled, insulated packaging from a climate-controlled warehouse — the same standard whether it\'s one fillet or a full kitchen restock.',
  },
  {
    icon: <Boxes size={22} />,
    problem: 'Inventory guesswork & waste',
    solution: 'Live stock visibility per item — current, reserved, incoming, damaged, and returned quantities, with a full movement history and a low-stock status you can check anytime.',
  },
  {
    icon: <ClipboardList size={22} />,
    problem: 'Disorganized supplier purchasing',
    solution: 'Purchase orders per supplier with batch numbers and expiry dates tracked from order to receiving — every stock intake is logged automatically.',
  },
  {
    icon: <Truck size={22} />,
    problem: 'Unpredictable delivery windows',
    solution: 'Pick express dispatch or a scheduled delivery slot at checkout, track every order live, and our delivery partners update status in real time — right through to photo proof of delivery.',
  },
  {
    icon: <LayoutDashboard size={22} />,
    problem: 'Manual order management',
    solution: 'One dashboard for every order — bulk status updates, automatic invoices, and a full tracking timeline, so nothing gets missed during a busy service.',
  },
  {
    icon: <Gift size={22} />,
    problem: 'Low repeat business',
    solution: 'Built-in loyalty points, membership tiers with real delivery perks, gift cards, and a referral program that rewards new customers from their very first order.',
  },
]

const TIERS = [
  { name: 'Silver', spend: 'Every account starts here', perk: 'Standard delivery pricing' },
  { name: 'Gold', spend: '₹10,000+ lifetime spend', perk: 'Free delivery on orders above ₹499' },
  { name: 'Platinum', spend: '₹30,000+ lifetime spend', perk: 'Free delivery on every order' },
]

function SolutionCard({ icon, problem, solution }: { icon: React.ReactNode; problem: string; solution: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6"
    >
      <div className="w-11 h-11 rounded-xl bg-premium-navy/5 dark:bg-ocean-800 flex items-center justify-center text-premium-teal mb-4">
        {icon}
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1.5">{problem}</p>
      <p className="text-sm text-premium-navy/80 dark:text-ocean-200 leading-relaxed">{solution}</p>
    </motion.div>
  )
}

export default function BusinessSolutionsPage() {
  return (
    <>
      <PageSEO
        title="Business Solutions for Restaurants, Hotels & Retailers — Divya Foods"
        description="Cold-chain delivery, live inventory tracking, purchase order management, and wholesale ordering — built for restaurants, hotels, and retailers sourcing premium seafood at scale."
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-premium-navy to-[#060F16] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="df-eyebrow mb-3 w-full">
            For Restaurants, Hotels & Retailers
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Sourcing premium seafood, without the operational headache
          </h1>
          <p className="text-premium-muted text-sm sm:text-base max-w-2xl mx-auto mb-8">
            From cold-chain packaging to inventory tracking and reliable delivery — everything
            we've built to run our own kitchen supply chain is available to yours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={ROUTES.BULK_ORDER}
              className="inline-flex items-center gap-2 bg-premium-gold hover:bg-premium-gold-light text-premium-navy font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Request a Wholesale Quote <ChevronRight size={16} />
            </Link>
            <a
              href={`tel:${CONFIG.CONTACT.PHONE_1.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 border border-white/30 hover:bg-white/10 text-white font-medium px-6 py-3 rounded-xl transition-colors"
            >
              <Phone size={15} /> Talk to Sales
            </a>
          </div>
        </div>
      </section>

      {/* Problem / solution grid */}
      <motion.section
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
        className="py-14 px-4"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-premium-navy dark:text-white mb-3">
              What's actually slowing your kitchen down
            </h2>
            <p className="text-premium-navy/50 dark:text-ocean-400 text-sm max-w-xl mx-auto">
              Real problems we've solved for our own operations — and built directly into the platform.
            </p>
          </div>

          <motion.div
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {SOLUTIONS.map(s => (
              <SolutionCard key={s.problem} {...s} />
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Membership perks */}
      <motion.section
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
        className="py-14 px-4 bg-premium-cream dark:bg-ocean-950"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Crown size={28} className="mx-auto text-premium-gold mb-3" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-premium-navy dark:text-white mb-3">
              The more you order, the more you save
            </h2>
            <p className="text-premium-navy/50 dark:text-ocean-400 text-sm max-w-xl mx-auto">
              Regular bulk buyers move up membership tiers automatically — no enrollment needed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {TIERS.map(t => (
              <div key={t.name} className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-5 text-center">
                <p className="font-display font-bold text-premium-navy dark:text-white mb-1">{t.name}</p>
                <p className="text-xs text-premium-navy/40 mb-3">{t.spend}</p>
                <p className="text-sm text-premium-navy/80 dark:text-ocean-200 flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} className="text-premium-teal shrink-0" /> {t.perk}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to={ROUTES.LOYALTY} className="text-sm font-semibold text-premium-teal hover:text-premium-gold inline-flex items-center gap-1">
              See your loyalty status <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </motion.section>

      {/* Final CTA */}
      <section className="py-14 px-4 bg-gradient-to-br from-premium-navy to-[#060F16] text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-2xl font-bold mb-3">Ready to simplify your supply chain?</h2>
          <p className="text-premium-muted text-sm mb-7">
            Tell us what your kitchen needs — we'll put together a custom quote and delivery plan.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={ROUTES.BULK_ORDER}
              className="inline-flex items-center gap-2 bg-premium-gold hover:bg-premium-gold-light text-premium-navy font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Request a Wholesale Quote <ChevronRight size={16} />
            </Link>
            <a
              href={`https://wa.me/${CONFIG.CONTACT.WHATSAPP}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-white/30 hover:bg-white/10 text-white font-medium px-6 py-3 rounded-xl transition-colors"
            >
              <MessageCircle size={15} /> Chat on WhatsApp
            </a>
          </div>
          <p className="text-xs text-premium-muted mt-6">
            Or call {CONFIG.CONTACT.PHONE_1} · {CONFIG.CONTACT.EMAIL}
          </p>
        </div>
      </section>
    </>
  )
}
