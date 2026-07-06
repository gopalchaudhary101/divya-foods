import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminInventoryPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const product = {
  id: 'p1', name: 'Salmon Fillet', slug: 'salmon-fillet', images: [], categoryName: 'Seafood',
  stockQuantity: 20, reservedStock: 5, availableStock: 15, incomingStock: 10,
  damagedStock: 2, returnedStock: 1, lowStockThreshold: 10, stockStatus: 'in_stock' as const,
}

const purchase = {
  id: 'pu1', productId: 'p1', supplierName: 'Ocean Traders', purchaseDate: '2026-01-01T00:00:00Z',
  unitCost: 300, quantity: 20, totalCost: 6000, invoiceNumber: 'INV-1', batchNumber: 'B-1',
  expiryDate: '2026-12-01T00:00:00Z', notes: '', status: 'ordered' as const,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  mock.reset()
  mock.onGet(/\/admin\/products\?limit=200/).reply(200, { success: true, data: { data: [{ id: 'p1', name: 'Salmon Fillet' }] } })
  mock.onGet(/\/admin\/products\?/).reply(200, { success: true, data: { data: [product], total: 1, page: 1, totalPages: 1 } })
  mock.onGet(/\/admin\/purchases/).reply(200, { success: true, data: { data: [purchase], total: 1, page: 1, totalPages: 1 } })
})

describe('AdminInventoryPage — Stock Overview', () => {
  it('lists products with inventory columns', async () => {
    renderWithProviders(<AdminInventoryPage />)
    expect(await screen.findByText('Salmon Fillet')).toBeInTheDocument()
    // Current=20, Reserved=5, Available=15, Incoming=10, Damaged=2, Returned=1
    const row = screen.getByText('Salmon Fillet').closest('tr')!
    expect(within(row).getByText('In Stock')).toBeInTheDocument()
    expect(within(row).getByText('20')).toBeInTheDocument()
    expect(within(row).getByText('15')).toBeInTheDocument()
  })

  it('filters by stock status', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)
    await screen.findByText('Salmon Fillet')

    await user.selectOptions(screen.getByDisplayValue('All statuses'), 'low_stock')

    await waitFor(() => {
      const lastCall = mock.history.get.filter(c => c.url?.includes('/admin/products?')).pop()
      expect(lastCall?.url).toContain('stockStatus=low_stock')
    })
  })

  it('adjusts stock via the modal', async () => {
    mock.onPost('/admin/products/p1/stock-adjustment').reply(200, { success: true, data: { ...product, stockQuantity: 25 } })
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByTitle('Adjust Stock'))

    expect(screen.getByText('Adjust Stock — Salmon Fillet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'add' }))
    await user.type(screen.getByRole('spinbutton'), '5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mock.history.post.some(c => c.url === '/admin/products/p1/stock-adjustment')).toBe(true))
    const body = JSON.parse(mock.history.post.find(c => c.url === '/admin/products/p1/stock-adjustment')!.data)
    expect(body).toEqual({ type: 'add', quantity: 5, note: undefined })
  })

  it('records a return via the modal', async () => {
    mock.onPost('/admin/products/p1/returns').reply(200, { success: true, data: product })
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByTitle('Record Return'))

    expect(screen.getByText('Record Return — Salmon Fillet')).toBeInTheDocument()
    await user.type(screen.getByRole('spinbutton'), '2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mock.history.post.some(c => c.url === '/admin/products/p1/returns')).toBe(true))
    const body = JSON.parse(mock.history.post.find(c => c.url === '/admin/products/p1/returns')!.data)
    expect(body.quantity).toBe(2)
    expect(body.restock).toBe(true) // checked by default
  })

  it('shows stock history in the modal', async () => {
    mock.onGet('/admin/products/p1/stock-history').reply(200, {
      success: true,
      data: { data: [{ id: 'm1', productId: 'p1', type: 'stock_added', quantityDelta: 5, resultingStock: 25, createdAt: '2026-01-01T00:00:00Z' }] },
    })
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByTitle('Stock History'))

    expect(await screen.findByText('Stock Added')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
  })
})

describe('AdminInventoryPage — Purchase Orders', () => {
  it('switches to the purchase orders tab and lists purchases', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Purchase Orders/ }))

    expect(await screen.findByText('Ocean Traders')).toBeInTheDocument()
    expect(screen.getByText('₹6,000')).toBeInTheDocument()
    expect(screen.getByText('ordered')).toBeInTheDocument()
  })

  it('creates a new purchase order', async () => {
    mock.onPost('/admin/purchases').reply(200, { success: true, data: purchase })
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Purchase Orders/ }))
    await screen.findByText('Ocean Traders')

    await user.click(screen.getByRole('button', { name: 'New Purchase' }))
    await screen.findByText('New Purchase Order')

    const productSelect = screen.getAllByRole('combobox').pop()!
    await user.selectOptions(productSelect, 'p1')

    const textInputs = screen.getAllByRole('textbox')
    await user.type(textInputs[0], 'New Supplier Co')

    const numberInputs = screen.getAllByRole('spinbutton')
    await user.type(numberInputs[0], '100')
    await user.type(numberInputs[1], '10')

    await user.click(screen.getByRole('button', { name: 'Create Purchase Order' }))

    await waitFor(() => expect(mock.history.post.some(c => c.url === '/admin/purchases')).toBe(true))
    const body = JSON.parse(mock.history.post.find(c => c.url === '/admin/purchases')!.data)
    expect(body.productId).toBe('p1')
    expect(body.supplierName).toBe('New Supplier Co')
  })

  it('receives a purchase order', async () => {
    mock.onPut('/admin/purchases/pu1/receive').reply(200, { success: true, data: { ...purchase, status: 'received' } })
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Purchase Orders/ }))
    await screen.findByText('Ocean Traders')

    await user.click(screen.getByRole('button', { name: 'Receive' }))

    await waitFor(() => expect(mock.history.put.some(c => c.url === '/admin/purchases/pu1/receive')).toBe(true))
  })

  it('cancels a purchase order', async () => {
    mock.onDelete('/admin/purchases/pu1').reply(200, { success: true })
    const user = userEvent.setup()
    renderWithProviders(<AdminInventoryPage />)

    await screen.findByText('Salmon Fillet')
    await user.click(screen.getByRole('button', { name: /Purchase Orders/ }))
    await screen.findByText('Ocean Traders')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(mock.history.delete.some(c => c.url === '/admin/purchases/pu1')).toBe(true))
  })
})
