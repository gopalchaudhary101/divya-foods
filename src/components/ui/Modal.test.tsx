import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal isOpen={false} onClose={vi.fn()}>Content</Modal>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the title and children when open', () => {
    render(<Modal isOpen onClose={vi.fn()} title="Confirm">Are you sure?</Modal>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal isOpen onClose={onClose} title="Confirm">Body</Modal>)
    await user.click(screen.getByLabelText('Close dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the Escape key is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Modal isOpen onClose={onClose}>Body</Modal>)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<Modal isOpen onClose={vi.fn()}>Body</Modal>)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Modal isOpen={false} onClose={vi.fn()}>Body</Modal>)
    expect(document.body.style.overflow).toBe('')
  })
})
