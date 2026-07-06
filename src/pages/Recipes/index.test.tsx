import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import RecipesPage from './index'
import { RECIPES } from '@/data/recipes'

describe('RecipesPage', () => {
  it('lists all recipes by default', () => {
    renderWithProviders(<RecipesPage />)
    expect(screen.getByText(`${RECIPES.length} recipes · Click any recipe to expand`)).toBeInTheDocument()
  })

  it('expands a recipe to show ingredients and method', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    const first = RECIPES[0]
    await user.click(screen.getByRole('button', { name: new RegExp(first.name) }))

    expect(screen.getByText('Ingredients')).toBeInTheDocument()
    expect(screen.getByText('Method')).toBeInTheDocument()
    expect(screen.getByText(first.ingredients[0])).toBeInTheDocument()
  })

  it('collapses an expanded recipe on second click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    const first = RECIPES[0]
    const button = screen.getByRole('button', { name: new RegExp(first.name) })
    await user.click(button)
    expect(screen.getByText('Ingredients')).toBeInTheDocument()

    await user.click(button)
    await waitFor(() => expect(screen.queryByText('Ingredients')).not.toBeInTheDocument())
  })

  it('filters recipes by protein', async () => {
    const salmonRecipe = RECIPES.find(r => r.protein === 'salmon')
    if (!salmonRecipe) return // skip if data set has no salmon recipe

    const user = userEvent.setup()
    renderWithProviders(<RecipesPage />)

    const salmonFilterCount = RECIPES.filter(r => r.protein === 'salmon').length
    await user.click(screen.getByRole('button', { name: '🐟 Salmon' }))

    expect(screen.getByText(`${salmonFilterCount} recipe${salmonFilterCount !== 1 ? 's' : ''} · Click any recipe to expand`)).toBeInTheDocument()
  })
})
