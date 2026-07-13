import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /**
   * 'premium' (default) matches the storefront's navy/gold design system used
   * by the other components/ui/* primitives. 'admin' matches the ocean/mint
   * palette every Admin/* page already uses, so a modal doesn't visually
   * clash with the rest of that page.
   */
  tone?: 'premium' | 'admin'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

const toneClasses = {
  premium: {
    backdrop: 'bg-premium-navy/70 backdrop-blur-sm',
    surface: 'shadow-premium',
    border: 'border-premium-navy/10 dark:border-ocean-800',
    title: 'text-premium-navy dark:text-white',
    closeButton: 'text-premium-navy/40 hover:text-premium-gold hover:bg-premium-navy/5 dark:hover:bg-ocean-800',
  },
  admin: {
    backdrop: 'bg-black/50',
    surface: 'shadow-2xl',
    border: 'border-ocean-100 dark:border-ocean-800',
    title: 'text-ocean-900 dark:text-white',
    closeButton: 'text-ocean-400 hover:text-ocean-700 hover:bg-ocean-50 dark:hover:bg-ocean-800',
  },
}

export function Modal({ isOpen, onClose, title, children, size = 'md', tone = 'premium' }: ModalProps) {
  const t = toneClasses[tone]

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className={`absolute inset-0 ${t.backdrop}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            className={[
              'relative w-full bg-white dark:bg-ocean-900 rounded-2xl',
              t.surface,
              'flex flex-col max-h-[90vh]',
              sizeClasses[size],
            ].join(' ')}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            {title && (
              <div className={`flex items-center justify-between px-6 py-4 border-b ${t.border}`}>
                <h2
                  id="modal-title"
                  className={`font-display text-lg font-semibold ${t.title}`}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close dialog"
                  className={`p-1.5 rounded-lg transition-colors ${t.closeButton}`}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Body */}
            <div className="overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
