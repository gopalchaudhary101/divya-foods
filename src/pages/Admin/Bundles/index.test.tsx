import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminBundlesPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const bundle = {
  id: 'b1', name: 'Seafood Combo', description: 'Great value', image: null,
  bundlePrice: 999, isActive: true, items: [{ productId: 'p1', quantity: 2, name: 'Salmon' }],
}
const product = { id: 'p1', name: 'Salmon', price: 500 }

beforeEach(() => {
  mock.reset()
  mock.onGet('/admin/bundles').reply(200, { success: true, data: [bundle] })
  mock.onGet('/admin/products?limit=200').reply(200, { data: [product] })
})

describe('AdminBundlesPage', () => {
  it('lists bundles with item count and price', async () => {
    renderWithProviders(<AdminBundlesPage />)
    expect(await screen.findByText('Seafood Combo')).toBeInTheDocument()
    expect(screen.getByText('1 items · ₹999')).toBeInTheDocument()
  })

  it('shows an empty state with no bundles', async () => {
    mock.onGet('/admin/bundles').reply(200, { success: true, data: [] })
    renderWithProviders(<AdminBundlesPage />)
    expect(await screen.findByText('No bundles yet. Create your first combo deal.')).toBeInTheDocument()
  })

  it('creates a new bundle by adding a product and price', async () => {
    mock.onPost('/admin/bundles').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminBundlesPage />)

    await screen.findByText('Seafood Combo')
    await user.click(screen.getAllByRole('button', { name: /New Bundle/ })[0])

    await user.type(screen.getByPlaceholderText('e.g. Salmon Lovers Pack'), 'Combo Deal')
    await user.type(screen.getByPlaceholderText('899'), '1200')

    const saveButton = screen.getByRole('button', { name: 'Save Bundle' })
    expect(saveButton).toBeDisabled() // no items added yet

    await user.click(screen.getByText('Add product'))
    expect(saveButton).not.toBeDisabled()

    await user.click(saveButton)

    await waitFor(() => expect(mock.history.post).toHaveLength(1))
    const body = JSON.parse(mock.history.post[0].data)
    expect(body.name).toBe('Combo Deal')
    expect(body.bundlePrice).toBe(1200)
    expect(body.items).toHaveLength(1)
  })

  it('toggles bundle active status', async () => {
    mock.onPut('/admin/bundles/b1').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminBundlesPage />)

    await screen.findByText('Seafood Combo')
    const toggleButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg.lucide-toggle-right, svg.lucide-toggle-left'))
    await user.click(toggleButtons[0])

    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    expect(JSON.parse(mock.history.put[0].data).isActive).toBe(false)
  })

  it('deletes a bundle after confirmation', async () => {
    mock.onDelete('/admin/bundles/b1').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminBundlesPage />)

    await screen.findByText('Seafood Combo')
    const deleteButton = screen.getAllByRole('button').find(b => b.querySelector('svg.lucide-trash2'))!
    await user.click(deleteButton)

    expect(screen.getByText('Delete bundle?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mock.history.delete).toHaveLength(1))
  })
})
