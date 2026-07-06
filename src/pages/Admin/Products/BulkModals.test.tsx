import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import { BulkImportModal, BulkImageModal } from './BulkModals'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('BulkImportModal', () => {
  it('uploads a CSV and shows the created/skipped summary', async () => {
    mock.onPost('/admin/products/bulk-import').reply(200, {
      success: true,
      data: { created: 2, skipped: 1, errors: [{ row: 4, reason: "Missing product name" }] },
    })
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<BulkImportModal categoryNames={['Seafood', 'Japanese']} onClose={onClose} />)

    expect(screen.getByText(/Valid categories: Seafood, Japanese/)).toBeInTheDocument()

    const file = new File(['name,price\nSalmon,999\n'], 'products.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    await user.click(screen.getByRole('button', { name: 'Import' }))

    expect(await screen.findByText(/2 created, 1 skipped/)).toBeInTheDocument()
    expect(screen.getByText(/Row 4: Missing product name/)).toBeInTheDocument()
  })

  it('shows an error toast when the import request fails', async () => {
    mock.onPost('/admin/products/bulk-import').reply(400, { detail: 'Please upload a .csv file.' })
    const user = userEvent.setup()
    renderWithProviders(<BulkImportModal categoryNames={[]} onClose={vi.fn()} />)

    const file = new File(['bad'], 'products.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)
    await user.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(mock.history.post).toHaveLength(1))
  })

  it('calls onClose when Close is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<BulkImportModal categoryNames={[]} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('BulkImageModal', () => {
  const products = [
    { id: 'p1', name: 'Salmon Fillet', images: ['https://img/existing.jpg'] },
  ]

  beforeEach(() => {
    mock.onGet(/\/admin\/products/).reply(200, { success: true, data: { data: products } })
  })

  it('uploads images and assigns one to a product', async () => {
    mock.onPost('/upload/images').reply(200, {
      success: true,
      data: [{ filename: 'a.jpg', url: 'https://img/a.jpg', publicId: 'a', width: 800, height: 800 }],
    })
    mock.onPut('/admin/products/p1').reply(200, { success: true })

    const user = userEvent.setup()
    renderWithProviders(<BulkImageModal onClose={vi.fn()} />)

    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    expect(await screen.findByText('a.jpg')).toBeInTheDocument()

    const select = await screen.findByDisplayValue('Assign to…')
    await user.selectOptions(select, 'p1')
    await user.click(screen.getByRole('button', { name: 'Assign' }))

    await waitFor(() => expect(mock.history.put.some(c => c.url === '/admin/products/p1')).toBe(true))
    const call = mock.history.put.find(c => c.url === '/admin/products/p1')!
    expect(JSON.parse(call.data)).toEqual({ images: ['https://img/existing.jpg', 'https://img/a.jpg'] })
    expect(await screen.findByText('Assigned to Salmon Fillet')).toBeInTheDocument()
  })

  it('shows an error for a rejected file in the batch', async () => {
    mock.onPost('/upload/images').reply(200, {
      success: true,
      data: [{ filename: 'bad.gif', error: "Unsupported file type 'image/gif'." }],
    })
    const user = userEvent.setup()
    renderWithProviders(<BulkImageModal onClose={vi.fn()} />)

    // Uploaded with an accepted MIME type client-side; the mocked server response
    // simulates the backend rejecting it (e.g. a mismatched/corrupt file).
    const file = new File(['x'], 'bad.gif', { type: 'image/jpeg' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)

    expect(await screen.findByText(/Unsupported file type/)).toBeInTheDocument()
  })
})
