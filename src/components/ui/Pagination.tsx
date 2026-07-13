import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** 'bordered' (default): "Page X of Y" left, controls right, top border. 'centered': controls + label centered, no border. */
  variant?: 'bordered' | 'centered'
  /** 'icons' (default): chevron-only buttons. 'text': "Previous"/"Next" labels. */
  buttons?: 'icons' | 'text'
}

const buttonBase = 'rounded-lg border border-ocean-200 dark:border-ocean-700 disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors'

export function Pagination({ page, totalPages, onPageChange, variant = 'bordered', buttons = 'icons' }: PaginationProps) {
  if (totalPages <= 1) return null

  const prevDisabled = page <= 1
  const nextDisabled = page >= totalPages

  const prevButton = buttons === 'icons' ? (
    <button
      onClick={() => onPageChange(Math.max(1, page - 1))}
      disabled={prevDisabled}
      aria-label="Previous page"
      className={`p-1.5 ${buttonBase}`}
    >
      <ChevronLeft size={14} />
    </button>
  ) : (
    <button
      onClick={() => onPageChange(Math.max(1, page - 1))}
      disabled={prevDisabled}
      className={`px-3 py-1.5 text-sm ${buttonBase}`}
    >
      Previous
    </button>
  )

  const nextButton = buttons === 'icons' ? (
    <button
      onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      disabled={nextDisabled}
      aria-label="Next page"
      className={`p-1.5 ${buttonBase}`}
    >
      <ChevronRight size={14} />
    </button>
  ) : (
    <button
      onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      disabled={nextDisabled}
      className={`px-3 py-1.5 text-sm ${buttonBase}`}
    >
      Next
    </button>
  )

  const pageLabel = <span className="text-xs text-ocean-400">Page {page} of {totalPages}</span>

  if (variant === 'centered') {
    return (
      <div className="flex items-center justify-center gap-3 mt-5">
        {prevButton}
        {pageLabel}
        {nextButton}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-ocean-100 dark:border-ocean-800">
      {pageLabel}
      <div className="flex gap-2">
        {prevButton}
        {nextButton}
      </div>
    </div>
  )
}
