import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import RecipesPage from './index'
import { recipeApi } from '@/services/api/recipeApi'
import type { Recipe } from '@/types'

vi.mock('@/services/api/recipeApi', () => ({
  recipeApi: { getList: vi.fn(), getBySlug: vi.fn(), getFilters: vi.fn() },
}))

const recipe: Recipe = {
  id: 'r1', title: 'Garlic Butter Salmon', slug: 'garlic-butter-salmon',
  description: 'Pan-seared salmon in a garlic butter sauce.',
  cuisine: 'Continental', category: 'seafood', ingredients: ['Salmon', 'Butter', 'Garlic'],
  steps: ['Sear the salmon', 'Baste with butter'], prepTimeMinutes: 10, cookTimeMinutes: 15,
  totalTimeMinutes: 25, difficulty: 'Easy', servings: 2, emoji: '🐟', image: null,
  tags: ['quick'], productTags: ['salmon'], metaTitle: 'Garlic Butter Salmon',
  metaDescription: 'A quick salmon recipe', searchKeywords: ['salmon recipe'],
  isPublished: true, createdAt: '', updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(recipeApi.getFilters).mockResolvedValue({ cuisines: ['Continental', 'Japanese'], categories: ['seafood', 'curry'], difficulties: ['Easy', 'Medium', 'Hard'] })
})

describe('RecipesPage', () => {
  it('shows a loading skeleton, then renders recipes', async () => {
    vi.mocked(recipeApi.getList).mockResolvedValue({ data: [recipe], total: 1, page: 1, limit: 12, totalPages: 1, success: true })
    renderWithProviders(<RecipesPage />)
    expect(await screen.findByText('Garlic Butter Salmon')).toBeInTheDocument()
    expect(screen.getByText('1 recipe found')).toBeInTheDocument()
  })

  it('shows an empty state when no recipes match', async () => {
    vi.mocked(recipeApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 12, totalPages: 0, success: true })
    renderWithProviders(<RecipesPage />)
    expect(await screen.findByText('No recipes match these filters yet. More coming soon!')).toBeInTheDocument()
  })

  it('links each recipe card to its detail page', async () => {
    vi.mocked(recipeApi.getList).mockResolvedValue({ data: [recipe], total: 1, page: 1, limit: 12, totalPages: 1, success: true })
    renderWithProviders(<RecipesPage />)
    const link = await screen.findByText('Garlic Butter Salmon')
    expect(link.closest('a')).toHaveAttribute('href', '/recipes/garlic-butter-salmon')
  })

  it('filters by cuisine from the tab bar', async () => {
    vi.mocked(recipeApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 12, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    await screen.findByText('Japanese')
    await user.click(screen.getByText('Japanese'))

    await waitFor(() => expect(recipeApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ cuisine: 'Japanese' })
    ))
  })

  it('filters by category from the tab bar', async () => {
    vi.mocked(recipeApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 12, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    await screen.findByText('curry')
    await user.click(screen.getByText('curry'))

    await waitFor(() => expect(recipeApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'curry' })
    ))
  })

  it('searches recipes with debounced input', async () => {
    vi.mocked(recipeApi.getList).mockResolvedValue({ data: [], total: 0, page: 1, limit: 12, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    await user.type(screen.getByLabelText('Search recipes'), 'salmon')

    await waitFor(() => expect(recipeApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'salmon' })
    ), { timeout: 2000 })
  })

  it('renders pagination and navigates pages', async () => {
    vi.mocked(recipeApi.getList).mockResolvedValue({ data: [recipe], total: 30, page: 1, limit: 12, totalPages: 3, success: true })
    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    await screen.findByText('Garlic Butter Salmon')
    await user.click(screen.getByRole('button', { name: '2' }))

    await waitFor(() => expect(recipeApi.getList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 })
    ))
  })
})
