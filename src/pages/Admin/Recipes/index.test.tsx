import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import AdminRecipesPage from './index'
import { adminRecipeApi, recipeApi } from '@/services/api/recipeApi'
import type { Recipe } from '@/types'

vi.mock('@/services/api/recipeApi', () => ({
  adminRecipeApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), bulkImport: vi.fn() },
  recipeApi: { getFilters: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const recipe: Recipe = {
  id: 'r1', title: 'Garlic Butter Salmon', slug: 'garlic-butter-salmon',
  description: 'Pan-seared salmon in a garlic butter sauce.',
  cuisine: 'Continental', category: 'seafood', ingredients: ['Salmon', 'Butter'],
  steps: ['Sear the salmon'], prepTimeMinutes: 10, cookTimeMinutes: 15,
  totalTimeMinutes: 25, difficulty: 'Easy', servings: 2, emoji: '🐟', image: null,
  tags: ['quick'], productTags: ['salmon'], metaTitle: 'Garlic Butter Salmon',
  metaDescription: 'A quick salmon recipe', searchKeywords: ['salmon recipe'],
  isPublished: true, createdAt: '', updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(recipeApi.getFilters).mockResolvedValue({ cuisines: ['Continental'], categories: ['seafood'], difficulties: ['Easy', 'Medium', 'Hard'] })
})

describe('AdminRecipesPage', () => {
  it('shows an empty state with no recipes', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    renderWithProviders(<AdminRecipesPage />)
    expect(await screen.findByText('No recipes match these filters')).toBeInTheDocument()
  })

  it('lists recipes with cuisine, category and difficulty', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [recipe], total: 1, page: 1, limit: 20, totalPages: 1, success: true })
    renderWithProviders(<AdminRecipesPage />)
    expect(await screen.findByText('Garlic Butter Salmon')).toBeInTheDocument()
    const row = screen.getByText('Garlic Butter Salmon').closest('tr')!
    expect(within(row).getByText('Continental')).toBeInTheDocument()
    expect(within(row).getByText('seafood')).toBeInTheDocument()
    expect(within(row).getByText('Easy')).toBeInTheDocument()
  })

  it('creates a new recipe', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    vi.mocked(adminRecipeApi.create).mockResolvedValue({ ...recipe, id: 'r2', title: 'Miso Salmon' })
    const user = userEvent.setup()
    renderWithProviders(<AdminRecipesPage />)

    await screen.findByText('No recipes match these filters')
    await user.click(screen.getByRole('button', { name: /New Recipe/ }))

    await user.type(screen.getByPlaceholderText('Garlic Butter Salmon'), 'Miso Salmon')
    await user.type(screen.getByPlaceholderText('Short, appetizing summary shown on recipe cards'), 'A rich miso glazed salmon dish.')
    await user.type(screen.getByPlaceholderText('Japanese, Indian, Continental…'), 'Japanese')
    await user.type(screen.getByPlaceholderText('seafood, curry, soup, grilled…'), 'seafood')
    await user.type(screen.getByPlaceholderText(/2 salmon fillets/), 'Salmon\nMiso paste')
    await user.type(screen.getByPlaceholderText(/Pat the salmon dry/), 'Marinate the salmon\nGrill until glazed')

    const createButtons = screen.getAllByRole('button', { name: 'Create Recipe' })
    await user.click(createButtons[createButtons.length - 1])

    await waitFor(() => expect(adminRecipeApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Miso Salmon', cuisine: 'Japanese', category: 'seafood' })
    ))
  })

  it('opens the edit modal pre-filled with recipe data', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [recipe], total: 1, page: 1, limit: 20, totalPages: 1, success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminRecipesPage />)

    await screen.findByText('Garlic Butter Salmon')
    await user.click(screen.getByLabelText('Edit Garlic Butter Salmon'))

    expect(screen.getByText('Edit Recipe')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Garlic Butter Salmon')).toHaveValue('Garlic Butter Salmon')
  })

  it('toggles publish state', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [recipe], total: 1, page: 1, limit: 20, totalPages: 1, success: true })
    vi.mocked(adminRecipeApi.update).mockResolvedValue({ ...recipe, isPublished: false })
    const user = userEvent.setup()
    renderWithProviders(<AdminRecipesPage />)

    await screen.findByText('Garlic Butter Salmon')
    await user.click(screen.getByLabelText('Unpublish Garlic Butter Salmon'))

    await waitFor(() => expect(adminRecipeApi.update).toHaveBeenCalledWith('r1', { isPublished: false }))
  })

  it('deletes a recipe after confirmation', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [recipe], total: 1, page: 1, limit: 20, totalPages: 1, success: true })
    vi.mocked(adminRecipeApi.delete).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<AdminRecipesPage />)

    await screen.findByText('Garlic Butter Salmon')
    await user.click(screen.getByLabelText('Delete Garlic Butter Salmon'))
    expect(screen.getByText('Delete Recipe')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(adminRecipeApi.delete).toHaveBeenCalledWith('r1'))
  })

  it('bulk imports recipes from pasted JSON', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    vi.mocked(adminRecipeApi.bulkImport).mockResolvedValue({ created: 2, skipped: 0, errors: [] })
    const user = userEvent.setup()
    renderWithProviders(<AdminRecipesPage />)

    await screen.findByText('No recipes match these filters')
    await user.click(screen.getByRole('button', { name: /Bulk Import/ }))

    const payload = JSON.stringify([
      { title: 'A', description: 'desc', cuisine: 'Japanese', category: 'seafood', ingredients: ['x'], steps: ['y'], prepTimeMinutes: 5, cookTimeMinutes: 5, difficulty: 'Easy', servings: 2 },
    ])
    fireEvent.change(screen.getByPlaceholderText(/"title": "..."/), { target: { value: payload } })

    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(adminRecipeApi.bulkImport).toHaveBeenCalled())
  })

  it('filters recipes by cuisine', async () => {
    vi.mocked(adminRecipeApi.list).mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0, success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminRecipesPage />)

    await screen.findByText('No recipes match these filters')
    await user.selectOptions(screen.getByDisplayValue('All cuisines'), 'Continental')

    await waitFor(() => expect(adminRecipeApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ cuisine: 'Continental' })
    ))
  })
})
