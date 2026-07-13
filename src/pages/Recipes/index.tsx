import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageSEO } from '@/components/shared/PageSEO'
import { RecipeCard } from '@/components/shared/RecipeCard'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRecipes, useRecipeFilters } from '@/hooks/useRecipes'
import { useDebounce } from '@/hooks/useDebounce'
import { ROUTES } from '@/constants/routes'
import type { RecipeListParams } from '@/services/api/recipeApi'

function RecipeCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 animate-pulse p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-premium-navy/10 dark:bg-ocean-800 shrink-0" />
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="h-4 bg-premium-navy/10 dark:bg-ocean-800 rounded w-2/3" />
          <div className="h-3 bg-premium-navy/10 dark:bg-ocean-800 rounded w-full" />
          <div className="h-3 bg-premium-navy/10 dark:bg-ocean-800 rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

export default function RecipesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const debouncedSearch = useDebounce(searchInput, 500)

  useEffect(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (debouncedSearch) next.set('search', debouncedSearch)
      else next.delete('search')
      next.delete('page')
      return next
    }, { replace: true })
  }, [debouncedSearch]) // eslint-disable-line

  const activeCuisine = searchParams.get('cuisine') || undefined
  const activeCategory = searchParams.get('category') || undefined
  const page = Number(searchParams.get('page') || '1')

  const filters: RecipeListParams = {
    page,
    limit: 12,
    cuisine: activeCuisine,
    category: activeCategory,
    search: searchParams.get('search') || undefined,
  }

  const { data, isLoading } = useRecipes(filters)
  const { data: filterOptions } = useRecipeFilters()

  const recipes = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  const cuisines = filterOptions?.cuisines ?? []
  const categories = filterOptions?.categories ?? []

  function setParam(key: string, value: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  return (
    <>
      <PageSEO
        title="Recipes & Cooking Ideas — Divya Luxury Seafoods"
        description="Recipes using Divya Luxury Seafoods premium imports — seafood, Japanese, curries, grilled dishes and more. Garlic butter salmon, crispy calamari, coconut prawn curry and more."
      />

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-premium-navy to-[#060F16] text-white px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="df-eyebrow mb-3 w-full">
            Cooking with Divya Luxury Seafoods
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">
            Recipes & Cooking Ideas
          </h1>
          <p className="text-premium-muted text-sm sm:text-base max-w-xl mx-auto">
            Step-by-step recipes using our premium imported seafood, Japanese pantry
            staples and more. From a quick 10-minute stir-fry to an impressive
            dinner-party centerpiece.
          </p>
        </div>
      </div>

      {/* ── Search + filter tabs ──────────────────────────────────────── */}
      <div className="sticky top-16 z-20 bg-white dark:bg-ocean-950 border-b border-premium-navy/10 dark:border-ocean-800 px-4 -mt-6">
        <div className="max-w-5xl mx-auto py-3 flex flex-col gap-3">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-premium-navy/40 pointer-events-none" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search recipes…"
              aria-label="Search recipes"
              className="w-full pl-9 pr-4 py-2 text-sm border border-premium-navy/15 dark:border-ocean-700 rounded-xl dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-premium-gold"
            />
          </div>

          {cuisines.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setParam('cuisine', null)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  !activeCuisine
                    ? 'bg-premium-gold text-premium-navy shadow-sm'
                    : 'bg-premium-navy/5 dark:bg-ocean-800 text-premium-navy/60 dark:text-ocean-300 hover:bg-premium-navy/10 dark:hover:bg-ocean-700'
                }`}
              >
                All cuisines
              </button>
              {cuisines.map((c) => (
                <button
                  key={c}
                  onClick={() => setParam('cuisine', c)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeCuisine === c
                      ? 'bg-premium-gold text-premium-navy shadow-sm'
                      : 'bg-premium-navy/5 dark:bg-ocean-800 text-premium-navy/60 dark:text-ocean-300 hover:bg-premium-navy/10 dark:hover:bg-ocean-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setParam('category', null)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  !activeCategory
                    ? 'bg-premium-teal text-white'
                    : 'bg-premium-navy/5 dark:bg-ocean-800 text-premium-navy/50 dark:text-ocean-400 hover:bg-premium-navy/10 dark:hover:bg-ocean-700'
                }`}
              >
                All dish types
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setParam('category', c)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
                    activeCategory === c
                      ? 'bg-premium-teal text-white'
                      : 'bg-premium-navy/5 dark:bg-ocean-800 text-premium-navy/50 dark:text-ocean-400 hover:bg-premium-navy/10 dark:hover:bg-ocean-700'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recipe grid ───────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {!isLoading && (
          <p className="text-xs text-premium-navy/40 mb-4">
            {total} recipe{total !== 1 ? 's' : ''} found
          </p>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }, (_, i) => <RecipeCardSkeleton key={i} />)}
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🍳</p>
            <p className="text-premium-navy/50">No recipes match these filters yet. More coming soon!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setParam('page', String(page - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-premium-navy/15 dark:border-ocean-700 text-premium-navy/70 dark:text-ocean-200 disabled:opacity-40 hover:bg-premium-navy/10 dark:hover:bg-ocean-800 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = i + 1
              return (
                <button
                  key={pg}
                  onClick={() => setParam('page', String(pg))}
                  className={[
                    'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                    pg === page
                      ? 'bg-premium-navy text-white'
                      : 'border border-premium-navy/15 dark:border-ocean-700 text-premium-navy/70 dark:text-ocean-200 hover:bg-premium-navy/10 dark:hover:bg-ocean-800',
                  ].join(' ')}
                >
                  {pg}
                </button>
              )
            })}

            <button
              onClick={() => setParam('page', String(page + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-premium-navy/15 dark:border-ocean-700 text-premium-navy/70 dark:text-ocean-200 disabled:opacity-40 hover:bg-premium-navy/10 dark:hover:bg-ocean-800 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <div className="bg-premium-cream dark:bg-ocean-900 border-t border-premium-navy/10 dark:border-ocean-800 px-4 py-10 text-center">
        <p className="text-premium-navy/70 dark:text-ocean-400 text-sm mb-4">
          Ready to cook? Get the freshest ingredients delivered to your door.
        </p>
        <Link
          to={ROUTES.PRODUCTS}
          className="inline-flex items-center gap-2 px-6 py-3 bg-premium-gold hover:bg-premium-gold-light text-premium-navy font-semibold rounded-full transition-colors text-sm"
        >
          Shop Fresh Seafood →
        </Link>
      </div>
    </>
  )
}
