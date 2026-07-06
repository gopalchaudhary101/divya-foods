import React from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'premium' | 'premiumOutline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-ocean-700 hover:bg-ocean-900 active:bg-ocean-900 text-white shadow-sm disabled:bg-ocean-300',
  secondary:
    'bg-gold-500 hover:bg-gold-600 active:bg-gold-600 text-white shadow-sm disabled:bg-gold-100',
  outline:
    'border border-ocean-700 text-ocean-700 hover:bg-ocean-50 active:bg-ocean-100 dark:border-ocean-300 dark:text-ocean-100 dark:hover:bg-ocean-900',
  ghost:
    'text-ocean-700 hover:bg-ocean-50 active:bg-ocean-100 dark:text-ocean-100 dark:hover:bg-ocean-900',
  danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm disabled:bg-red-300',
  // Premium redesign variants — additive, used by storefront pages only (admin keeps the variants above).
  premium:
    'bg-premium-gold hover:bg-premium-gold-light active:bg-premium-gold-light text-premium-navy shadow-sm disabled:bg-premium-navy/10 disabled:text-premium-muted',
  premiumOutline:
    'border border-premium-navy/20 text-premium-navy hover:bg-premium-navy/5 active:bg-premium-navy/10 dark:border-white/20 dark:text-white dark:hover:bg-white/10',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-xl gap-2.5',
  icon: 'p-2 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-medium transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  )
}
