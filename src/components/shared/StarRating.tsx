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
                  ? 'text-gold-500 fill-gold-500'
                  : half
                    ? 'text-gold-400 fill-gold-200'
                    : 'text-ocean-200 fill-ocean-100'
              }
            />
          )
        })}
      </div>
      {showCount && count !== undefined && (
        <span className="text-xs text-ocean-400 dark:text-ocean-300">({count})</span>
      )}
    </div>
  )
}
