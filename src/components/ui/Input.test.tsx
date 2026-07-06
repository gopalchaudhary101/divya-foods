import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('derives an id from the label when none is given', () => {
    render(<Input label="Full Name" />)
    expect(screen.getByLabelText('Full Name')).toHaveAttribute('id', 'full-name')
  })

  it('shows an asterisk and a screen-reader "(required)" hint when required', () => {
    render(<Input label="Phone" required />)
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByText('(required)')).toBeInTheDocument()
  })

  it('renders an error message with role="alert" and marks the input invalid', () => {
    render(<Input label="Email" error="Invalid email address" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address')
  })

  it('shows helper text only when there is no error', () => {
    const { rerender } = render(<Input label="Email" helperText="We'll never share this" />)
    expect(screen.getByText("We'll never share this")).toBeInTheDocument()

    rerender(<Input label="Email" helperText="We'll never share this" error="Required" />)
    expect(screen.queryByText("We'll never share this")).not.toBeInTheDocument()
  })

  it('fires onChange as the user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Input label="Search" onChange={onChange} />)
    await user.type(screen.getByLabelText('Search'), 'salmon')
    expect(onChange).toHaveBeenCalledTimes(6)
  })
})
