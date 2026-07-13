import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Users, BarChart2, Tag } from 'lucide-react'
import type { Recipe } from '@/types'
import { ROUTES } from '@/constants/routes'

const DIFF_COLOR: Record<Recipe['difficulty'], string> = {
  Easy:   'bg-premium-teal/10 text-premium-teal',
  Medium: 'bg-premium-gold/10 text-premium-gold',
  Hard:   'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} mins`
  const hrs = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hrs}h ${rest}m` : `${hrs}h`
}

interface RecipeCardProps {
  recipe: Recipe
}

// Grids can render dozens of these at once (paginated up to 48/page) —
// memoized so a re-render elsewhere on the page doesn't re-render every card.
function RecipeCardImpl({ recipe }: RecipeCardProps) {
  return (
    <Link
      to={ROUTES.RECIPE_DETAIL.replace(':slug', recipe.slug)}
      className="block bg-white dark:bg-ocean-900 rounded-2xl border border-premium-navy/10 dark:border-ocean-800 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="p-5 flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-premium-navy/5 dark:bg-ocean-800 flex items-center justify-center text-3xl shrink-0">
          {recipe.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-premium-navy dark:text-white text-base sm:text-lg leading-tight line-clamp-1">
            {recipe.title}
          </h3>
          <p className="text-premium-navy/50 dark:text-ocean-400 text-sm mt-1 line-clamp-2">
            {recipe.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-2.5">
            <span className="flex items-center gap-1 text-xs text-premium-navy/50">
              <Clock size={12} /> {formatTime(recipe.totalTimeMinutes)}
            </span>
            <span className="flex items-center gap-1 text-xs text-premium-navy/50">
              <Users size={12} /> Serves {recipe.servings}
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${DIFF_COLOR[recipe.difficulty]}`}>
              <BarChart2 size={11} /> {recipe.difficulty}
            </span>
          </div>

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {recipe.tags.slice(0, 4).map(t => (
                <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-premium-navy/5 dark:bg-ocean-800 text-premium-navy/50 dark:text-ocean-400 rounded-full">
                  <Tag size={9} />{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export const RecipeCard = memo(RecipeCardImpl)
