import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Add to Cart</Button>)
    expect(screen.getByRole('button', { name: 'Add to Cart' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button onClick={onClick}>Click</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and does not fire onClick when the disabled prop is set', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button disabled onClick={onClick}>Click</Button>)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is disabled and shows a spinner when loading', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Button loading onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('hides the right icon while loading but keeps children visible', () => {
    render(<Button loading rightIcon={<span data-testid="right-icon" />}>Save</Button>)
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })
})
