import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import RecipeDetailPage from './index'
import { recipeApi } from '@/services/api/recipeApi'
import { createTestStore, createTestQueryClient } from '@/test/testUtils'
import type { RecipeDetail } from '@/types'

vi.mock('@/services/api/recipeApi', () => ({
  recipeApi: { getList: vi.fn(), getBySlug: vi.fn(), getFilters: vi.fn() },
}))

function renderAtSlug(slug: string) {
  const store = createTestStore()
  const queryClient = createTestQueryClient()
  return render(
    <HelmetProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/recipes/${slug}`]}>
            <Routes>
              <Route path="/recipes/:slug" element={<RecipeDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    </HelmetProvider>
  )
}

const recipe: RecipeDetail = {
  id: 'r1', title: 'Garlic Butter Salmon', slug: 'garlic-butter-salmon',
  description: 'Pan-seared salmon in a garlic butter sauce.',
  cuisine: 'Continental', category: 'seafood', ingredients: ['2 salmon fillets', '3 tbsp butter'],
  steps: ['Sear the salmon', 'Baste with butter'], prepTimeMinutes: 10, cookTimeMinutes: 15,
  totalTimeMinutes: 25, difficulty: 'Easy', servings: 2, emoji: '🐟', image: null,
  tags: ['quick'], productTags: ['salmon'], metaTitle: 'Garlic Butter Salmon — Divya Foods',
  metaDescription: 'A quick salmon recipe', searchKeywords: ['salmon recipe'],
  isPublished: true, createdAt: '', updatedAt: '',
  recommendedProducts: [{ id: 'p1', name: 'Norwegian Salmon', slug: 'norwegian-salmon', price: 899, image: null, inStock: true }],
  relatedRecipes: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RecipeDetailPage', () => {
  it('shows "Recipe Not Found" when the slug does not resolve', async () => {
    vi.mocked(recipeApi.getBySlug).mockRejectedValue(new Error('404'))
    renderAtSlug('does-not-exist')
    expect(await screen.findByText('Recipe Not Found')).toBeInTheDocument()
  })

  it('renders recipe details, ingredients and steps', async () => {
    vi.mocked(recipeApi.getBySlug).mockResolvedValue(recipe)
    renderAtSlug('garlic-butter-salmon')

    expect(await screen.findByRole('heading', { name: 'Garlic Butter Salmon' })).toBeInTheDocument()
    expect(screen.getByText('2 salmon fillets')).toBeInTheDocument()
    expect(screen.getByText('Sear the salmon')).toBeInTheDocument()
    expect(screen.getByText('25 mins total')).toBeInTheDocument()
    expect(screen.getByText('Serves 2')).toBeInTheDocument()
    expect(document.title).toBe('Garlic Butter Salmon — Divya Foods')
  })

  it('includes Recipe and BreadcrumbList JSON-LD schema', async () => {
    vi.mocked(recipeApi.getBySlug).mockResolvedValue(recipe)
    renderAtSlug('garlic-butter-salmon')
    await screen.findByRole('heading', { name: 'Garlic Butter Salmon' })

    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    const parsed = scripts.map(s => JSON.parse(s.textContent ?? '{}'))

    const recipeLD = parsed.find(ld => ld['@type'] === 'Recipe')
    expect(recipeLD).toBeDefined()
    expect(recipeLD.name).toBe('Garlic Butter Salmon')
    expect(recipeLD.prepTime).toBe('PT10M')
    expect(recipeLD.cookTime).toBe('PT15M')
    expect(recipeLD.totalTime).toBe('PT25M')
    expect(recipeLD.recipeIngredient).toEqual(['2 salmon fillets', '3 tbsp butter'])

    const breadcrumb = parsed.find(ld => ld['@type'] === 'BreadcrumbList')
    expect(breadcrumb).toBeDefined()
    expect(breadcrumb.itemListElement.map((i: { name: string }) => i.name)).toEqual(['Home', 'Recipes', 'Garlic Butter Salmon'])
  })

  it('shows recommended products linking to the product detail page', async () => {
    vi.mocked(recipeApi.getBySlug).mockResolvedValue(recipe)
    renderAtSlug('garlic-butter-salmon')

    await screen.findByRole('heading', { name: 'Garlic Butter Salmon' })
    const productLink = screen.getByText('Norwegian Salmon')
    expect(productLink.closest('a')).toHaveAttribute('href', '/products/norwegian-salmon')
  })

  it('does not show a recommended products section when there are none', async () => {
    vi.mocked(recipeApi.getBySlug).mockResolvedValue({ ...recipe, recommendedProducts: [] })
    renderAtSlug('garlic-butter-salmon')

    await screen.findByRole('heading', { name: 'Garlic Butter Salmon' })
    expect(screen.queryByText('Shop the ingredients')).not.toBeInTheDocument()
  })

  it('shows related recipes when present', async () => {
    vi.mocked(recipeApi.getBySlug).mockResolvedValue({
      ...recipe,
      relatedRecipes: [{ ...recipe, id: 'r2', title: 'Miso Glazed Salmon', slug: 'miso-glazed-salmon' }],
    })
    renderAtSlug('garlic-butter-salmon')

    await screen.findByRole('heading', { name: 'Garlic Butter Salmon' })
    expect(await screen.findByText('You may also like')).toBeInTheDocument()
    expect(screen.getByText('Miso Glazed Salmon')).toBeInTheDocument()
  })
})
