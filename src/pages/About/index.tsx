import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShieldCheck, FileText, MapPin, Phone, Mail } from 'lucide-react'
import { PageSEO } from '@/components/shared/PageSEO'
import { settingsApi } from '@/services/api/settingsApi'
import { CONFIG } from '@/constants/config'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function AboutPage() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60 * 60 * 1000,
  })

  return (
    <>
      <PageSEO
        title={`About Us — ${CONFIG.APP_NAME}`}
        description="Learn about Divya Luxury Seafoods — our story, contact details, and legal/business information (GST & FSSAI license)."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <motion.div initial="hidden" animate="visible" variants={fadeUp}>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-premium-navy dark:text-white mb-3">
            About {CONFIG.APP_NAME}
          </h1>
          <p className="text-premium-navy/70 dark:text-ocean-300 leading-relaxed max-w-2xl">
            {CONFIG.TAGLINE} — we source premium frozen seafood and gourmet goods and
            deliver them fresh to your doorstep across Delhi NCR.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="mt-10 bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl p-6 sm:p-8"
        >
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-premium-navy dark:text-white mb-5">
            <ShieldCheck className="text-premium-teal" size={22} />
            Legal & Business Information
          </h2>

          <dl className="grid sm:grid-cols-2 gap-5">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-premium-navy/40">
                Business Name
              </dt>
              <dd className="mt-1 text-premium-navy dark:text-ocean-100">
                {settings?.businessName ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-premium-navy/40 flex items-center gap-1.5">
                <FileText size={13} /> GSTIN
              </dt>
              <dd className="mt-1 text-premium-navy dark:text-ocean-100">
                {settings?.gstNumber ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-premium-navy/40 flex items-center gap-1.5">
                <ShieldCheck size={13} /> FSSAI License No.
              </dt>
              <dd className="mt-1 text-premium-navy dark:text-ocean-100">
                {settings?.fssaiNumber ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-premium-navy/40 flex items-center gap-1.5">
                <MapPin size={13} /> Address
              </dt>
              <dd className="mt-1 text-premium-navy dark:text-ocean-100">
                {CONFIG.CONTACT.ADDRESS}
              </dd>
            </div>
          </dl>

          <div className="mt-6 pt-6 border-t border-premium-navy/10 dark:border-ocean-800 flex flex-col sm:flex-row gap-4 text-sm text-premium-navy/70 dark:text-ocean-300">
            <a href={`tel:${CONFIG.CONTACT.PHONE_1.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-premium-gold transition-colors">
              <Phone size={14} /> {CONFIG.CONTACT.PHONE_1}
            </a>
            <a href={`mailto:${CONFIG.CONTACT.EMAIL}`} className="flex items-center gap-2 hover:text-premium-gold transition-colors">
              <Mail size={14} /> {CONFIG.CONTACT.EMAIL}
            </a>
          </div>
        </motion.div>
      </div>
    </>
  )
}
