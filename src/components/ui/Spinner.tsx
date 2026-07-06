import React from 'react'

type SpinnerSize = 'sm' | 'md' | 'lg'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-4',
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={[
        'rounded-full border-premium-navy/15 border-t-premium-gold animate-spin',
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-premium-cream dark:bg-ocean-950">
      <Spinner size="lg" />
      <p className="text-sm text-premium-navy/40 font-medium tracking-wide">Loading…</p>
    </div>
  )
}
