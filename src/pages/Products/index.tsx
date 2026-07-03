import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageSEO } from '@/components/shared/PageSEO'
import { SlidersHorizontal, X, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useProducts, useCategories } from '@/hooks/useProducts'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { addToCart } from '@/features/cart/cartSlice'
import { ProductCard } from '@/components/shared/ProductCard'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useDebounce } from '@/hooks/useDebounce'
import type { Product } from '@/types'
import type { ProductListParams } from '@/services/api/productApi'
import toast from 'react-hot-toast'

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Top Rated', value: 'rating' },
  { label: 'Most Popular', value: 'popular' },
] as const

function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 animate-pulse">
      <div className="aspect-square bg-ocean-100 dark:bg-ocean-800" />
      <div className="p-4 flex flex-col gap-3">
        <div className="h-4 bg-ocean-100 dark:bg-ocean-800 rounded w-3/4" />
        <div className="h-3 bg-ocean-100 dark:bg-ocean-800 rounded w-1/2" />
        <div className="h-3 bg-ocean-100 dark:bg-ocean-800 rounded w-1/3" />
        <div className="h-9 bg-ocean-100 dark:bg-ocean-800 rounded-xl mt-1" />
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [filterOpen, setFilterOpen] = useState(false)
  const debouncedSearch = useDebounce(searchInput, 500)

  // Sync debounced search to URL
  React.useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debouncedSearch) {
          next.set('q', debouncedSearch)
        } else {
          next.delete('q')
        }
        next.delete('page')
        return next
      },
      { replace: true }
    )
  }, [debouncedSearch]) // eslint-disable-line

  const filters: ProductListParams = {
    page: Number(searchParams.get('page') || '1'),
    limit: 12,
    category: searchParams.get('category') || undefined,
    sortBy: (searchParams.get('sort') as ProductListParams['sortBy']) || 'newest',
    search: searchParams.get('q') || undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    inStock: searchParams.get('inStock') === 'true' ? true : undefined,
  }

  const { data, isLoading, isFetching } = useProducts(filters)
  const { data: categoriesData } = useCategories()

  const products = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0
  const page = filters.page ?? 1
  const categories = categoriesData ?? []

  const activeCategory = searchParams.get('category')
  const activeSort = searchParams.get('sort') || 'newest'
  const isInStock = searchParams.get('inStock') === 'true'

  function setParam(key: string, value: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  function clearAllFilters() {
    setSearchInput('')
    setSearchParams(new URLSearchParams())
  }

  function handleAddToCart(product: Product) {
    dispatch(
      addToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.images[0] ?? '',
        maxQuantity: product.stockQuantity ?? 10,
      })
    )
    toast.success(`${product.name} added to cart!`)
  }

  const hasActiveFilters = activeCategory || isInStock || searchInput ||
    searchParams.get('minPrice') || searchParams.get('maxPrice')

  const filterSidebar = (
    <aside className="flex flex-col gap-6">
      {/* Categories */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-3">
          Category
        </p>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setParam('category', null)}
            className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
              !activeCategory
                ? 'bg-ocean-700 text-white font-medium'
                : 'text-ocean-700 dark:text-ocean-200 hover:bg-ocean-50 dark:hover:bg-ocean-800'
            }`}
          >
            All Products {!activeCategory && total > 0 && (
              <span className="ml-1 opacity-70">({total})</span>
            )}
          </button>
          {categories.map((cat: { slug: string; name: string; productCount: number }) => (
            <button
              key={cat.slug}
              onClick={() => setParam('category', cat.slug)}
              className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeCategory === cat.slug
                  ? 'bg-ocean-700 text-white font-medium'
                  : 'text-ocean-700 dark:text-ocean-200 hover:bg-ocean-50 dark:hover:bg-ocean-800'
              }`}
            >
              {cat.name}
              <span className="ml-1 opacity-60 text-xs">({cat.productCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* In Stock */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-3">
          Availability
        </p>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={isInStock}
            onChange={(e) => setParam('inStock', e.target.checked ? 'true' : null)}
            className="w-4 h-4 accent-ocean-700 rounded"
          />
          <span className="text-sm text-ocean-700 dark:text-ocean-200 group-hover:text-ocean-900">
            In stock only
          </span>
        </label>
      </div>

      {/* Price Range */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ocean-400 mb-3">
          Price Range (₹)
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={searchParams.get('minPrice') || ''}
            onBlur={(e) => setParam('minPrice', e.target.value || null)}
            className="w-full border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-1.5 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-ocean-500"
          />
          <span className="text-ocean-300 shrink-0">–</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={searchParams.get('maxPrice') || ''}
            onBlur={(e) => setParam('maxPrice', e.target.value || null)}
            className="w-full border border-ocean-200 dark:border-ocean-700 rounded-lg px-3 py-1.5 text-sm dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-ocean-500"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          <X size={14} />
          Clear all filters
        </button>
      )}
    </aside>
  )

  return (
    <>
      <PageSEO
        title={
          activeCategory
            ? `${categories.find((c: { slug: string }) => c.slug === activeCategory)?.name ?? 'Products'} — Divya Foods`
            : 'All Products — Divya Foods'
        }
        description={
          activeCategory
            ? `Shop premium imported ${categories.find((c: { slug: string }) => c.slug === activeCategory)?.name?.toLowerCase() ?? 'seafood'} online. Delivered across Delhi NCR.`
            : 'Browse our full range of premium imported seafood and Japanese grocery — Salmon, Prawns, Tuna, Crab, Lobster, Miso and more. Delivered across Delhi NCR.'
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ocean-900 dark:text-white">
              {activeCategory
                ? categories.find((c: { slug: string }) => c.slug === activeCategory)?.name ?? 'Products'
                : 'All Products'}
            </h1>
            {!isLoading && (
              <p className="mt-1 text-sm text-ocean-400">
                {total} {total === 1 ? 'product' : 'products'} found
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Search bar */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean-400 pointer-events-none" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products…"
                className="pl-9 pr-4 py-2 text-sm border border-ocean-200 dark:border-ocean-700 rounded-xl dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500 w-44 sm:w-56"
              />
            </div>

            {/* Sort */}
            <select
              value={activeSort}
              onChange={(e) => setParam('sort', e.target.value)}
              className="text-sm border border-ocean-200 dark:border-ocean-700 rounded-xl px-3 py-2 dark:bg-ocean-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-ocean-500"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<SlidersHorizontal size={14} />}
              onClick={() => setFilterOpen((v) => !v)}
              className="lg:hidden"
            >
              Filters
              {hasActiveFilters && (
                <Badge variant="default" className="ml-1.5 text-[10px] px-1.5 py-0">
                  •
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {activeCategory && (
              <button
                onClick={() => setParam('category', null)}
                className="flex items-center gap-1.5 px-3 py-1 bg-ocean-100 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-200 rounded-full text-xs font-medium hover:bg-ocean-200 transition-colors"
              >
                {categories.find((c: { slug: string }) => c.slug === activeCategory)?.name ?? activeCategory}
                <X size={11} />
              </button>
            )}
            {isInStock && (
              <button
                onClick={() => setParam('inStock', null)}
                className="flex items-center gap-1.5 px-3 py-1 bg-ocean-100 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-200 rounded-full text-xs font-medium hover:bg-ocean-200 transition-colors"
              >
                In Stock <X size={11} />
              </button>
            )}
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="flex items-center gap-1.5 px-3 py-1 bg-ocean-100 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-200 rounded-full text-xs font-medium hover:bg-ocean-200 transition-colors"
              >
                "{searchInput}" <X size={11} />
              </button>
            )}
          </div>
        )}

        {/* Mobile filter panel */}
        {filterOpen && (
          <div className="lg:hidden bg-ocean-50 dark:bg-ocean-900 rounded-2xl p-6 mb-6 border border-ocean-100 dark:border-ocean-800">
            {filterSidebar}
          </div>
        )}

        {/* Body */}
        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <div className="hidden lg:block w-52 shrink-0">
            {filterSidebar}
          </div>

          {/* Products grid */}
          <div className="flex-1 min-w-0">
            {isFetching && !isLoading && (
              <div className="flex items-center gap-2 text-sm text-ocean-400 mb-4">
                <Spinner size="sm" />
                Updating…
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {Array.from({ length: 12 }, (_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <p className="text-4xl">🐟</p>
                <p className="text-ocean-500 dark:text-ocean-300 text-lg font-medium">
                  No products found
                </p>
                <p className="text-sm text-ocean-400">Try adjusting your filters or search term.</p>
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {products.map((product: Product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => setParam('page', String(page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-ocean-200 dark:border-ocean-700 text-ocean-700 dark:text-ocean-200 disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
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
                          ? 'bg-ocean-700 text-white'
                          : 'border border-ocean-200 dark:border-ocean-700 text-ocean-700 dark:text-ocean-200 hover:bg-ocean-50 dark:hover:bg-ocean-800',
                      ].join(' ')}
                    >
                      {pg}
                    </button>
                  )
                })}

                <button
                  onClick={() => setParam('page', String(page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-ocean-200 dark:border-ocean-700 text-ocean-700 dark:text-ocean-200 disabled:opacity-40 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
