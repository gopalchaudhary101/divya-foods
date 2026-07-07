import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminProductsPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const category = { id: 'c1', name: 'Seafood', slug: 'seafood' }
const product = {
  id: 'p1', name: 'Salmon Fillet', slug: 'salmon-fillet', price: 999, images: [],
  categoryId: 'c1', categoryName: 'Seafood', inStock: true, stockQuantity: 10,
  rating: 4, reviewCount: 5, tags: [], isFeatured: false, isBestSeller: false,
  description: '', createdAt: '',
}

beforeEach(() => {
  mock.reset()
  mock.onGet('/admin/categories').reply(200, { success: true, data: [category] })
  mock.onGet(/\/admin\/products/).reply(200, { success: true, data: { data: [product], total: 1, page: 1, totalPages: 1 } })
})

describe('AdminProductsPage', () => {
  it('lists products with category and price', async () => {
    renderWithProviders(<AdminProductsPage />)
    expect(await screen.findByText('Salmon Fillet')).toBeInTheDocument()
    expect(screen.getAllByText('Seafood').length).toBeGreaterThan(0)
    expect(screen.getByText('₹999')).toBeInTheDocument()
  })

  it('shows an empty state when there are no products', async () => {
    mock.onGet(/\/admin\/products/).reply(200, { success: true, data: { data: [], total: 0, page: 1, totalPages: 0 } })
    renderWithProviders(<AdminProductsPage />)
    expect(await screen.findByText('No products yet. Add your first one!')).toBeInTheDocument()
  })

  it('opens the add-product drawer and auto-generates a slug from the name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Add Product/ }))

    expect(screen.getByRole('heading', { name: 'Add Product' })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('e.g. Salmon Fillet 500g'), 'Tiger Prawns 1kg')

    expect(screen.getByPlaceholderText('auto-generated from name')).toHaveValue('tiger-prawns-1kg')
  })

  it('creates a new product', async () => {
    mock.onPost('/admin/products').reply(200, { success: true, data: { id: 'p2' } })
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Add Product/ }))

    await user.type(screen.getByPlaceholderText('e.g. Salmon Fillet 500g'), 'Tiger Prawns')
    const comboboxes = screen.getAllByRole('combobox')
    const categorySelect = comboboxes[comboboxes.length - 1]
    await user.selectOptions(categorySelect, 'c1')
    await user.type(screen.getByPlaceholderText('0.00'), '1200')
    await user.click(screen.getByRole('button', { name: 'Create Product' }))

    await waitFor(() => expect(mock.history.post).toHaveLength(1))
    const body = JSON.parse(mock.history.post[0].data)
    expect(body.name).toBe('Tiger Prawns')
    expect(body.price).toBe(1200)
  })

  it('opens the edit drawer pre-filled with product data', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByTitle('Edit'))

    expect(screen.getByText('Edit Product')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Salmon Fillet 500g')).toHaveValue('Salmon Fillet')
  })

  it('deletes a product after confirmation', async () => {
    mock.onDelete('/admin/products/p1').reply(200, { success: true });
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByTitle('Delete'))

    expect(screen.getByText('Delete Product')).toBeInTheDocument()
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
  })

  it('toggles in-stock status via the quick toggle', async () => {
    mock.onPut('/admin/products/p1').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByTitle('Toggle In Stock'))

    await waitFor(() => expect(mock.history.put[0].data).toBe(JSON.stringify({ inStock: false })))
  })

  it('filters products by search term', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.type(screen.getByPlaceholderText('Search products…'), 'Salmon')

    await waitFor(() => {
      const lastCall = mock.history.get.filter(c => c.url?.includes('/admin/products')).pop()
      expect(lastCall?.url).toContain('search=Salmon')
    })
  })
})

describe('AdminProductsPage — bulk actions', () => {
  function getRowCheckbox() {
    const buttons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-square, svg.lucide-square-check-big'))
    return buttons[1] // [0] is "select all"
  }

  it('selects a row and shows the bulk action bar', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(getRowCheckbox())

    expect(await screen.findByText('1 selected')).toBeInTheDocument()
  })

  it('applies a bulk "mark featured" action to selected products', async () => {
    mock.onPut('/admin/products/bulk-update').reply(200, { success: true, data: { updated: 1 } })
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(getRowCheckbox())
    await screen.findByText('1 selected')

    await user.selectOptions(screen.getByDisplayValue('Mark In Stock'), 'Mark Featured')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(mock.history.put.some(c => c.url === '/admin/products/bulk-update')).toBe(true))
    const call = mock.history.put.find(c => c.url === '/admin/products/bulk-update')!
    expect(JSON.parse(call.data)).toEqual({ productIds: ['p1'], isFeatured: true })
  })

  it('shows a confirm modal and bulk-deletes selected products', async () => {
    mock.onPost('/admin/products/bulk-delete').reply(200, { success: true, data: { deleted: 1 } })
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(getRowCheckbox())
    await screen.findByText('1 selected')

    await user.selectOptions(screen.getByDisplayValue('Mark In Stock'), 'Delete')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(screen.getByText('Delete Products')).toBeInTheDocument()
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[deleteButtons.length - 1])

    await waitFor(() => expect(mock.history.post.some(c => c.url === '/admin/products/bulk-delete')).toBe(true))
  })

  it('opens the products CSV export URL in a new tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Export CSV/ }))

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('/admin/products/export'), '_blank')
  })

  it('opens the bulk import modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Import CSV/ }))

    expect(screen.getByText('Bulk Import Products')).toBeInTheDocument()
  })

  it('opens the bulk image upload modal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminProductsPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Bulk Images/ }))

    expect(screen.getByText('Bulk Image Upload')).toBeInTheDocument()
  })
})
