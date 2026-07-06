import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageSEO } from '@/components/shared/PageSEO'
import { Clock, ChevronDown, ChevronUp, Users, BarChart2, Tag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RECIPES, RECIPE_FILTERS, type Recipe } from '@/data/recipes'
import { ROUTES } from '@/constants/routes'

// ─── Difficulty badge ─────────────────────────────────────────────────────────

const DIFF_COLOR: Record<Recipe['difficulty'], string> = {
  Easy:   'bg-premium-teal/10 text-premium-teal',
  Medium: 'bg-premium-gold/10 text-premium-gold',
  Hard:   'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ─── Single recipe card ───────────────────────────────────────────────────────

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      layout
      className="bg-white dark:bg-ocean-900 rounded-2xl border border-premium-navy/10 dark:border-ocean-800 overflow-hidden shadow-sm"
    >
      {/* Card header — always visible */}
      <button
        className="w-full text-left p-5 flex items-start gap-4"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="w-14 h-14 rounded-xl bg-premium-navy/5 dark:bg-ocean-800 flex items-center justify-center text-3xl shrink-0">
          {recipe.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-premium-navy dark:text-white text-base sm:text-lg leading-tight">
            {recipe.name}
          </h3>
          <p className="text-premium-navy/50 dark:text-ocean-400 text-sm mt-1 line-clamp-2">
            {recipe.description}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-2.5">
            <span className="flex items-center gap-1 text-xs text-premium-navy/50">
              <Clock size={12} /> {recipe.time}
            </span>
            <span className="flex items-center gap-1 text-xs text-premium-navy/50">
              <Users size={12} /> Serves {recipe.serves}
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${DIFF_COLOR[recipe.difficulty]}`}>
              <BarChart2 size={11} /> {recipe.difficulty}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {recipe.tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-premium-navy/5 dark:bg-ocean-800 text-premium-navy/50 dark:text-ocean-400 rounded-full">
                <Tag size={9} />{t}
              </span>
            ))}
          </div>
        </div>

        <div className="text-premium-navy/40 shrink-0 mt-1">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expandable details */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-premium-navy/10 dark:border-ocean-800">
              <div className="grid sm:grid-cols-2 gap-5 mt-4">
                {/* Ingredients */}
                <div>
                  <h4 className="df-eyebrow mb-2.5">
                    Ingredients
                  </h4>
                  <ul className="space-y-1.5">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-premium-navy/80 dark:text-ocean-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-premium-gold mt-2 shrink-0" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Steps */}
                <div>
                  <h4 className="df-eyebrow mb-2.5">
                    Method
                  </h4>
                  <ol className="space-y-2.5">
                    {recipe.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-premium-navy/80 dark:text-ocean-300">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-premium-gold text-premium-navy flex items-center justify-center text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Shop CTA */}
              <div className="mt-5 pt-4 border-t border-premium-navy/5 dark:border-ocean-800">
                <p className="text-xs text-premium-navy/50 mb-2">Need ingredients? Shop our premium {recipe.protein} collection.</p>
                <Link
                  to={`${ROUTES.PRODUCTS}?search=${recipe.protein}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-premium-teal hover:text-premium-gold transition-colors"
                >
                  Shop {recipe.protein.charAt(0).toUpperCase() + recipe.protein.slice(1)} →
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecipesPage() {
  const [activeFilter, setActiveFilter] = useState<Recipe['protein'] | null>(null)

  const filtered = activeFilter ? RECIPES.filter(r => r.protein === activeFilter) : RECIPES

  return (
    <>
      <PageSEO
        title="Recipes & Cooking Ideas — Divya Foods"
        description="Easy seafood recipes using Divya Foods premium imports. Garlic butter salmon, crispy calamari, coconut prawn curry and more."
      />

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-premium-navy to-[#060F16] text-white px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="df-eyebrow mb-3 w-full">
            Cooking with Divya Foods
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-3">
            Recipes & Cooking Ideas
          </h1>
          <p className="text-premium-muted text-sm sm:text-base max-w-xl mx-auto">
            Step-by-step recipes using our premium imported seafood. From a quick 10-minute
            stir-fry to an impressive dinner-party centerpiece.
          </p>
        </div>
      </div>

      {/* ── Filter tabs ───────────────────────────────────────────────── */}
      <div className="sticky top-16 z-20 bg-white dark:bg-ocean-950 border-b border-premium-navy/10 dark:border-ocean-800 px-4 -mt-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 overflow-x-auto py-3 scrollbar-none">
            {RECIPE_FILTERS.map(f => (
              <button
                key={f.label}
                onClick={() => setActiveFilter(f.value)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeFilter === f.value
                    ? 'bg-premium-gold text-premium-navy shadow-sm'
                    : 'bg-premium-navy/5 dark:bg-ocean-800 text-premium-navy/60 dark:text-ocean-300 hover:bg-premium-navy/10 dark:hover:bg-ocean-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recipe grid ───────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-xs text-premium-navy/40 mb-4">
          {filtered.length} recipe{filtered.length !== 1 ? 's' : ''} · Click any recipe to expand
        </p>

        <motion.div layout className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filtered.map(recipe => (
              <motion.div
                key={recipe.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <RecipeCard recipe={recipe} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🍳</p>
            <p className="text-premium-navy/50">No recipes for this filter yet. More coming soon!</p>
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
