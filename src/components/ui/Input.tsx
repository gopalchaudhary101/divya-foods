import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const errorId = error ? `${inputId}-error` : undefined
  const helperId = !error && helperText ? `${inputId}-helper` : undefined
  const describedBy = errorId ?? helperId

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-premium-navy dark:text-ocean-100"
        >
          {label}
          {rest.required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          {rest.required && <span className="sr-only">(required)</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-premium-navy/40 pointer-events-none" aria-hidden="true">{leftIcon}</span>
        )}

        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={[
            'w-full rounded-xl border bg-white px-4 py-2.5 text-sm',
            'text-premium-navy placeholder:text-premium-navy/30',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-premium-gold focus:border-transparent',
            'disabled:cursor-not-allowed disabled:bg-premium-navy/5 disabled:text-premium-navy/30',
            'dark:bg-ocean-900 dark:text-ocean-50 dark:border-ocean-700 dark:placeholder:text-ocean-500',
            error ? 'border-red-400 focus:ring-red-400' : 'border-premium-navy/15',
            leftIcon ? 'pl-10' : '',
            rightIcon ? 'pr-10' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />

        {rightIcon && (
          <span className="absolute right-3 text-premium-navy/40">{rightIcon}</span>
        )}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-500 flex items-center gap-1">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helperId} className="text-xs text-premium-navy/40">{helperText}</p>
      )}
    </div>
  )
}
