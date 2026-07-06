import React from 'react'

/**
 * Photograph-free hero backdrop for the premium redesign — a deep navy/charcoal
 * gradient with a slow Ken Burns zoom and a subtle wave motif at the base.
 * Presentational only; no props tie it to data or business logic.
 */
const PremiumHeroBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-0 df-hero-zoom"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, #1B3A4B 0%, var(--df-navy) 55%, #060F16 100%)',
        }}
      />

      {/* Soft teal glow, top-left */}
      <div
        className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--df-teal) 0%, transparent 70%)' }}
      />
      {/* Soft gold glow, bottom-right */}
      <div
        className="absolute -bottom-32 -right-16 w-[480px] h-[480px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--df-gold) 0%, transparent 70%)' }}
      />

      {/* Dark gradient overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#060F16]" />

      {/* Wave motif at the base */}
      <div className="absolute bottom-0 left-0 right-0 h-24 opacity-50">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-full">
          <path
            d="M0,60 C150,100 350,0 600,40 C850,80 1050,20 1200,60 L1200,120 L0,120 Z"
            fill="#13242F"
          />
        </svg>
      </div>
    </div>
  )
}

export default PremiumHeroBackground
