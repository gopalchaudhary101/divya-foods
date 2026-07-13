import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the current page and total', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
  })

  it('disables Previous on the first page and Next on the last page', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} buttons="text" />)
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).not.toBeDisabled()

    rerender(<Pagination page={3} totalPages={3} onPageChange={vi.fn()} buttons="text" />)
    expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('calls onPageChange with the next/previous page', async () => {
    const onPageChange = vi.fn()
    const user = userEvent.setup()
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} buttons="text" />)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('renders icon-only buttons by default with accessible labels', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} />)
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
    expect(screen.getByLabelText('Next page')).toBeInTheDocument()
  })
})
