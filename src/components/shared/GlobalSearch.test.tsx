import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import { GlobalSearch } from './GlobalSearch'
import { productApi } from '@/services/api/productApi'

vi.mock('@/services/api/productApi', () => ({
  productApi: { getSuggestions: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('GlobalSearch', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<GlobalSearch isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows popular searches by default when open with no query', () => {
    renderWithProviders(<GlobalSearch isOpen onClose={vi.fn()} />)
    expect(screen.getByText('Salmon')).toBeInTheDocument()
    expect(screen.getByText('Wasabi')).toBeInTheDocument()
  })

  it('fetches suggestions after typing 2+ characters (debounced)', async () => {
    vi.mocked(productApi.getSuggestions).mockResolvedValue([
      { id: 'p1', name: 'Salmon Fillet', slug: 'salmon-fillet', price: 999, image: null, brand: null },
    ])
    const user = userEvent.setup()
    renderWithProviders(<GlobalSearch isOpen onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(/Search products/), 'sa')

    await waitFor(() => expect(productApi.getSuggestions).toHaveBeenCalledWith('sa', 7))
    expect(await screen.findByText('Salmon Fillet')).toBeInTheDocument()
  })

  it('does not search for a single character', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GlobalSearch isOpen onClose={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/Search products/), 's')
    await new Promise((r) => setTimeout(r, 300))
    expect(productApi.getSuggestions).not.toHaveBeenCalled()
  })

  it('shows a "no results" state with fallback popular chips', async () => {
    vi.mocked(productApi.getSuggestions).mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<GlobalSearch isOpen onClose={vi.fn()} />)
    await user.type(screen.getByPlaceholderText(/Search products/), 'xyz')
    expect(await screen.findByText('No results for')).toBeInTheDocument()
  })

  it('navigating to a suggestion via click saves it to recent searches', async () => {
    vi.mocked(productApi.getSuggestions).mockResolvedValue([
      { id: 'p1', name: 'Salmon Fillet', slug: 'salmon-fillet', price: 999, image: null, brand: null },
    ])
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<GlobalSearch isOpen onClose={onClose} />)

    await user.type(screen.getByPlaceholderText(/Search products/), 'sa')
    await user.click(await screen.findByText('Salmon Fillet'))

    expect(onClose).toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('divya_recent_searches') ?? '[]')).toContain('Salmon Fillet')
  })

  it('closes when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<GlobalSearch isOpen onClose={onClose} />)
    await user.type(screen.getByPlaceholderText(/Search products/), '{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('clears the query when the clear button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GlobalSearch isOpen onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText(/Search products/) as HTMLInputElement
    await user.type(input, 'sal')
    await user.click(screen.getByLabelText('Clear'))
    expect(input.value).toBe('')
  })
})
