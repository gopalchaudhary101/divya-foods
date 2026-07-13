import { useQuery } from '@tanstack/react-query'
import { recipeApi, type RecipeListParams } from '@/services/api/recipeApi'
import { queryKeys } from '@/services/queryKeys'

/**
 * Paginated + filtered recipe list.
 * Powers: /recipes listing page and the Home/JapaneseGrocery preview sections.
 */
export function useRecipes(params?: RecipeListParams) {
  return useQuery({
    queryKey: queryKeys.recipes.list(params),
    queryFn: () => recipeApi.getList(params),
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * Single recipe by URL slug, with resolved product recommendations and
 * related recipes. Disabled when slug is falsy (e.g. route not yet matched).
 */
export function useRecipe(slug: string) {
  return useQuery({
    queryKey: queryKeys.recipes.detail(slug),
    queryFn: () => recipeApi.getBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * Distinct cuisines/categories currently in use — powers the filter tabs.
 * staleTime is long because this only changes when new recipe types are added.
 */
export function useRecipeFilters() {
  return useQuery({
    queryKey: queryKeys.recipes.filters(),
    queryFn: recipeApi.getFilters,
    staleTime: 1000 * 60 * 30,
  })
}
