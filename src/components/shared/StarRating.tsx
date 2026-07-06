import React from 'react'
import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  count?: number
  size?: number
  showCount?: boolean
}

export function StarRating({ rating, count, size = 14, showCount = true }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const filled = i < Math.floor(rating)
          const half = !filled && i < rating
          return (
            <Star
              key={i}
              size={size}
              className={
                filled
                  ? 'text-premium-gold fill-premium-gold'
                  : half
                    ? 'text-premium-gold fill-premium-gold/30'
                    : 'text-premium-muted/40 fill-transparent'
              }
            />
          )
        })}
      </div>
      {showCount && count !== undefined && (
        <span className="text-xs text-premium-muted">({count})</span>
      )}
    </div>
  )
}
