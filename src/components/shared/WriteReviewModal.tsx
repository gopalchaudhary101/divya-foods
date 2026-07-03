import { useState } from 'react'
import { Star, X, CheckCircle, ShoppingBag, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useCanReview, useSubmitReview, useDeleteReview } from '@/hooks/useReviews'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

// ─── Star picker ──────────────────────────────────────────────────────────────

const LABELS = ['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent']

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value
  return (
    <div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`Rate ${n} star${n !== 1 ? 's' : ''}`}
            className="transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 rounded"
          >
            <Star
              size={32}
              className={n <= active
                ? 'text-gold-500 fill-gold-500'
                : 'text-ocean-200 dark:text-ocean-700 fill-ocean-100 dark:fill-ocean-800'
              }
            />
          </button>
        ))}
      </div>
      {active > 0 && (
        <p className="text-sm font-medium text-gold-600 dark:text-gold-400 mt-1">{LABELS[active]}</p>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface WriteReviewModalProps {
  productId:   string
  productName: string
  onClose:     () => void
}

export function WriteReviewModal({ productId, productName, onClose }: WriteReviewModalProps) {
  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated)
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')

  const { data: eligibility, isLoading: checkLoading } = useCanReview(productId)
  const submitMutation = useSubmitReview()
  const deleteMutation = useDeleteReview(productId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return
    submitMutation.mutate(
      { productId, rating, comment },
      { onSuccess: onClose },
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ocean-100 dark:border-ocean-800">
          <h3 id="review-modal-title" className="font-display font-semibold text-ocean-900 dark:text-white">
            Review — <span className="font-normal text-ocean-500 text-sm">{productName}</span>
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-ocean-50 dark:hover:bg-ocean-800 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5">
          {/* Not logged in */}
          {!isAuthenticated && (
            <div className="text-center py-4">
              <Lock size={28} className="mx-auto text-ocean-300 mb-3" />
              <p className="text-sm text-ocean-600 dark:text-ocean-300 mb-4">
                Please sign in to leave a review.
              </p>
              <Link
                to={ROUTES.AUTH.LOGIN}
                onClick={onClose}
                className="inline-flex items-center gap-2 bg-ocean-700 hover:bg-ocean-900 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}

          {/* Loading eligibility */}
          {isAuthenticated && checkLoading && (
            <div className="py-8 flex justify-center">
              <div className="w-7 h-7 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Already reviewed */}
          {isAuthenticated && !checkLoading && eligibility?.reason === 'already_reviewed' && (
            <div className="text-center py-4">
              <CheckCircle size={28} className="mx-auto text-mint-500 mb-3" />
              <p className="text-sm font-medium text-ocean-800 dark:text-ocean-100 mb-1">
                You've already reviewed this product.
              </p>
              <p className="text-xs text-ocean-400 mb-5">
                Want to remove your review?
              </p>
              <Button
                variant="outline"
                size="sm"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(eligibility.reviewId!, { onSuccess: onClose })}
                className="text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete My Review
              </Button>
            </div>
          )}

          {/* Not a buyer */}
          {isAuthenticated && !checkLoading && eligibility?.reason === 'no_purchase' && (
            <div className="text-center py-4">
              <ShoppingBag size={28} className="mx-auto text-ocean-300 mb-3" />
              <p className="text-sm text-ocean-600 dark:text-ocean-300">
                Only customers who have <strong>received</strong> this product can leave a review.
              </p>
            </div>
          )}

          {/* Write form */}
          {isAuthenticated && !checkLoading && eligibility?.canReview && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-2">Your Rating *</p>
                <StarPicker value={rating} onChange={setRating} />
                {!rating && submitMutation.isError && (
                  <p className="text-xs text-red-500 mt-1">Please select a rating.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ocean-500 uppercase tracking-widest mb-1">
                  Your Review *
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Share your experience with this product — freshness, packaging, taste..."
                  rows={4}
                  minLength={10}
                  required
                  className="w-full rounded-xl border border-ocean-200 dark:border-ocean-700 bg-white dark:bg-ocean-900 px-3 py-2.5 text-sm text-ocean-900 dark:text-white placeholder:text-ocean-300 resize-none focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
                <p className="text-xs text-ocean-400 mt-0.5 text-right">{comment.length}/1000</p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary" size="sm" className="flex-1"
                  loading={submitMutation.isPending}
                  disabled={!rating || comment.length < 10}
                >
                  Submit Review
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
