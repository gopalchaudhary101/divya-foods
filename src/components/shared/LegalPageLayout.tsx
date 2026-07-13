import React from 'react'
import { motion } from 'framer-motion'
import { PageSEO } from '@/components/shared/PageSEO'

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

interface LegalPageLayoutProps {
  title: string
  description: string
  lastUpdated: string
  children: React.ReactNode
}

/** Shared shell for Privacy/Terms/Refund/Shipping/Cancellation/Cookies pages — one
 * consistent prose layout matching the site's premium design language. */
export function LegalPageLayout({ title, description, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <>
      <PageSEO title={`${title} — Divya Foods`} description={description} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <motion.div initial="hidden" animate="visible" variants={fadeUp}>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-premium-navy dark:text-white mb-2">
            {title}
          </h1>
          <p className="text-xs text-premium-navy/40 dark:text-ocean-500 mb-10">
            Last updated: {lastUpdated}
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          className="space-y-6 text-sm sm:text-[15px] leading-relaxed text-premium-navy/80 dark:text-ocean-200
                     [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-premium-navy [&_h2]:dark:text-white [&_h2]:mt-8 [&_h2]:mb-3
                     [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
                     [&_a]:text-premium-teal [&_a]:hover:text-premium-gold [&_a]:transition-colors"
        >
          {children}
        </motion.div>
      </div>
    </>
  )
}
