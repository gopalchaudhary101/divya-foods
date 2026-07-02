import { useQuery } from '@tanstack/react-query'
import { productApi, type ProductListParams } from '@/services/api/productApi'
import { categoryApi } from '@/services/api/categoryApi'
import { queryKeys } from '@/services/queryKeys'

/**
 * Paginated + filtered product list.
 * Powers: /products listing page, category pages, search results.
 */
export function useProducts(params?: ProductListParams) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => productApi.getList(params),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Single product by URL slug.
 * Disabled when slug is falsy (e.g. route not yet matched).
 */
export function useProduct(slug: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(slug),
    queryFn: () => productApi.getBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 1000 * 60 * 10,
  })
}

/** Homepage "Featured Products" section. */
export function useFeaturedProducts() {
  return useQuery({
    queryKey: queryKeys.products.featured(),
    queryFn: productApi.getFeatured,
    staleTime: 1000 * 60 * 10,
  })
}

/** Homepage "Best Sellers" section. */
export function useBestSellers() {
  return useQuery({
    queryKey: queryKeys.products.bestSellers(),
    queryFn: productApi.getBestSellers,
    staleTime: 1000 * 60 * 10,
  })
}

/**
 * Search results — enabled only when query >= 2 characters.
 * Always pair with useDebounce to avoid a request on every keystroke.
 */
export function useProductSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.products.search(query),
    queryFn: () => productApi.search(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 2,
  })
}

/**
 * All active categories — used in navbar, homepage grid, filter sidebar.
 * staleTime is 30 minutes because categories change very rarely.
 */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all(),
    queryFn: categoryApi.getAll,
    staleTime: 1000 * 60 * 30,
  })
}
