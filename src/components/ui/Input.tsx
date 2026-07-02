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

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-ocean-900 dark:text-ocean-100"
        >
          {label}
          {rest.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-ocean-400 pointer-events-none">{leftIcon}</span>
        )}

        <input
          id={inputId}
          className={[
            'w-full rounded-xl border bg-white px-4 py-2.5 text-sm',
            'text-ocean-900 placeholder:text-ocean-300',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:bg-ocean-50 disabled:text-ocean-400',
            'dark:bg-ocean-900 dark:text-ocean-50 dark:border-ocean-700 dark:placeholder:text-ocean-500',
            error ? 'border-red-400 focus:ring-red-400' : 'border-ocean-200',
            leftIcon ? 'pl-10' : '',
            rightIcon ? 'pr-10' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />

        {rightIcon && (
          <span className="absolute right-3 text-ocean-400">{rightIcon}</span>
        )}
      </div>

      {error && <p className="text-xs text-red-500 flex items-center gap-1">{error}</p>}
      {!error && helperText && (
        <p className="text-xs text-ocean-400">{helperText}</p>
      )}
    </div>
  )
}
