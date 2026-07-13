import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { RecipeCard } from './RecipeCard'
import type { Recipe } from '@/types'

const baseRecipe: Recipe = {
  id: 'r1', title: 'Garlic Butter Salmon', slug: 'garlic-butter-salmon',
  description: 'Pan-seared salmon in a garlic butter sauce.',
  cuisine: 'Continental', category: 'seafood', ingredients: ['Salmon', 'Butter'],
  steps: ['Sear the salmon'], prepTimeMinutes: 10, cookTimeMinutes: 15,
  totalTimeMinutes: 25, difficulty: 'Easy', servings: 2, emoji: '🐟', image: null,
  tags: ['quick', 'keto', 'party', 'dinner', 'extra'], productTags: ['salmon'],
  metaTitle: 'Garlic Butter Salmon', metaDescription: 'A quick salmon recipe',
  searchKeywords: ['salmon recipe'], isPublished: true, createdAt: '', updatedAt: '',
}

function renderCard(recipe: Recipe) {
  return render(<MemoryRouter><RecipeCard recipe={recipe} /></MemoryRouter>)
}

describe('RecipeCard', () => {
  it('renders title, description, servings and difficulty', () => {
    renderCard(baseRecipe)
    expect(screen.getByText('Garlic Butter Salmon')).toBeInTheDocument()
    expect(screen.getByText('Pan-seared salmon in a garlic butter sauce.')).toBeInTheDocument()
    expect(screen.getByText('Serves 2')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
  })

  it('formats total time under an hour as minutes', () => {
    renderCard(baseRecipe)
    expect(screen.getByText('25 mins')).toBeInTheDocument()
  })

  it('formats total time over an hour as hours and minutes', () => {
    renderCard({ ...baseRecipe, totalTimeMinutes: 90 })
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
  })

  it('formats an exact hour without a minutes remainder', () => {
    renderCard({ ...baseRecipe, totalTimeMinutes: 60 })
    expect(screen.getByText('1h')).toBeInTheDocument()
  })

  it('shows at most 4 tags', () => {
    renderCard(baseRecipe)
    expect(screen.getByText('quick')).toBeInTheDocument()
    expect(screen.getByText('keto')).toBeInTheDocument()
    expect(screen.getByText('party')).toBeInTheDocument()
    expect(screen.getByText('dinner')).toBeInTheDocument()
    expect(screen.queryByText('extra')).not.toBeInTheDocument()
  })

  it('links to the recipe detail page by slug', () => {
    renderCard(baseRecipe)
    expect(screen.getByText('Garlic Butter Salmon').closest('a')).toHaveAttribute('href', '/recipes/garlic-butter-salmon')
  })
})
