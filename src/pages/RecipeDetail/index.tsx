import { useParams, Link } from 'react-router-dom'
import { PageSEO } from '@/components/shared/PageSEO'
import { RecipeCard } from '@/components/shared/RecipeCard'
import { Clock, Users, BarChart2, ShoppingCart, ChevronRight } from 'lucide-react'
import { useRecipe } from '@/hooks/useRecipes'
import { formatCurrency } from '@/utils/formatCurrency'
import { getBreadcrumbLD } from '@/utils/structuredData'
import { ROUTES } from '@/constants/routes'
import type { RecipeDetail } from '@/types'

const SITE_URL = 'https://divya-foods.vercel.app'

/** schema.org/Recipe expects ISO 8601 durations, e.g. 90 minutes → "PT1H30M". */
function toISODuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `PT${mins}M`
  return mins === 0 ? `PT${hrs}H` : `PT${hrs}H${mins}M`
}

function getRecipeLD(r: RecipeDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    description: r.description,
    ...(r.image && { image: [r.image] }),
    author: { '@type': 'Organization', name: 'Divya Foods' },
    recipeCuisine: r.cuisine,
    recipeCategory: r.category,
    prepTime: toISODuration(r.prepTimeMinutes),
    cookTime: toISODuration(r.cookTimeMinutes),
    totalTime: toISODuration(r.totalTimeMinutes),
    recipeYield: `${r.servings} servings`,
    recipeIngredient: r.ingredients,
    recipeInstructions: r.steps.map((step) => ({ '@type': 'HowToStep', text: step })),
    keywords: [...r.tags, ...r.searchKeywords].join(', '),
  }
}

const DIFF_COLOR: Record<RecipeDetail['difficulty'], string> = {
  Easy:   'bg-premium-teal/10 text-premium-teal',
  Medium: 'bg-premium-gold/10 text-premium-gold',
  Hard:   'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: recipe, isLoading, error } = useRecipe(slug ?? '')

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse">
        <div className="h-8 bg-premium-navy/10 rounded w-2/3 mb-4" />
        <div className="h-4 bg-premium-navy/10 rounded w-full mb-2" />
        <div className="h-4 bg-premium-navy/10 rounded w-1/2 mb-8" />
        <div className="h-64 bg-premium-navy/10 rounded-2xl" />
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-4">🍳</p>
        <h1 className="font-display text-2xl text-premium-navy dark:text-white mb-2">Recipe Not Found</h1>
        <p className="text-premium-navy/50 mb-6">This recipe may have been removed or the URL is incorrect.</p>
        <Link
          to={ROUTES.RECIPES}
          className="inline-flex items-center justify-center font-medium transition-all duration-200 bg-premium-gold hover:bg-premium-gold-light text-premium-navy shadow-sm px-7 py-3.5 text-base rounded-xl"
        >
          Browse All Recipes
        </Link>
      </div>
    )
  }

  return (
    <>
      <PageSEO
        title={recipe.metaTitle}
        description={recipe.metaDescription}
      >
        <script type="application/ld+json">{JSON.stringify(getRecipeLD(recipe))}</script>
        <script type="application/ld+json">
          {JSON.stringify(getBreadcrumbLD([
            { name: 'Home', url: SITE_URL },
            { name: 'Recipes', url: `${SITE_URL}/recipes` },
            { name: recipe.title, url: `${SITE_URL}/recipes/${recipe.slug}` },
          ]))}
        </script>
      </PageSEO>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-premium-navy/40 mb-6">
          <Link to={ROUTES.RECIPES} className="hover:text-premium-gold transition-colors">Recipes</Link>
          <ChevronRight size={12} />
          <span className="text-premium-navy/60 dark:text-ocean-300 line-clamp-1">{recipe.title}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-premium-navy/5 dark:bg-ocean-800 flex items-center justify-center text-4xl shrink-0">
            {recipe.emoji}
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-premium-navy dark:text-white leading-tight">
              {recipe.title}
            </h1>
            <p className="text-premium-navy/50 dark:text-ocean-400 text-sm mt-1">{recipe.cuisine} · {recipe.category}</p>
          </div>
        </div>

        <p className="text-premium-navy/70 dark:text-ocean-300 mb-6">{recipe.description}</p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-premium-navy/10 dark:border-ocean-800">
          <span className="flex items-center gap-1.5 text-sm text-premium-navy/60 dark:text-ocean-300">
            <Clock size={14} /> {recipe.totalTimeMinutes} mins total
          </span>
          <span className="flex items-center gap-1.5 text-sm text-premium-navy/60 dark:text-ocean-300">
            <Users size={14} /> Serves {recipe.servings}
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${DIFF_COLOR[recipe.difficulty]}`}>
            <BarChart2 size={12} /> {recipe.difficulty}
          </span>
        </div>

        {/* Ingredients + Method */}
        <div className="grid sm:grid-cols-2 gap-8 mb-10">
          <div>
            <h2 className="df-eyebrow mb-3">Ingredients</h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-premium-navy/80 dark:text-ocean-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-premium-gold mt-2 shrink-0" />
                  {ing}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="df-eyebrow mb-3">Method</h2>
            <ol className="space-y-3">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-premium-navy/80 dark:text-ocean-300">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-premium-gold text-premium-navy flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Recommended products */}
        {recipe.recommendedProducts.length > 0 && (
          <div className="mb-10 pt-6 border-t border-premium-navy/10 dark:border-ocean-800">
            <h2 className="df-eyebrow mb-3">Shop the ingredients</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recipe.recommendedProducts.map((p) => (
                <Link
                  key={p.id}
                  to={ROUTES.PRODUCT_DETAIL.replace(':slug', p.slug)}
                  className="block bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-xl p-3 hover:shadow-md transition-shadow"
                >
                  <p className="text-xs font-medium text-premium-navy dark:text-white line-clamp-2 mb-1">{p.name}</p>
                  <p className="text-sm font-semibold text-premium-gold">{formatCurrency(p.price)}</p>
                  {!p.inStock && <p className="text-[10px] text-premium-navy/40 mt-1">Out of stock</p>}
                </Link>
              ))}
            </div>
            <Link
              to={ROUTES.PRODUCTS}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-premium-teal hover:text-premium-gold transition-colors mt-3"
            >
              <ShoppingCart size={12} /> Shop all products →
            </Link>
          </div>
        )}

        {/* Related recipes */}
        {recipe.relatedRecipes.length > 0 && (
          <div className="pt-6 border-t border-premium-navy/10 dark:border-ocean-800">
            <h2 className="df-eyebrow mb-3">You may also like</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {recipe.relatedRecipes.map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
