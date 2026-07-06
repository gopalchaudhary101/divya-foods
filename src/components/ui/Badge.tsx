import React from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-premium-navy/10 text-premium-navy dark:bg-ocean-900 dark:text-ocean-200',
  success: 'bg-premium-teal/15 text-premium-teal',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-600',
  info: 'bg-blue-100 text-blue-700',
  gold: 'bg-premium-gold/15 text-premium-gold',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  )
}
