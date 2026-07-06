import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PincodeChecker } from './PincodeChecker'

describe('PincodeChecker', () => {
  it('auto-checks once 6 digits are entered and reports Delhi as serviceable', async () => {
    const user = userEvent.setup()
    render(<PincodeChecker />)
    await user.type(screen.getByPlaceholderText('Enter pincode'), '110044')
    expect(await screen.findByText(/Delivery available in Delhi/)).toBeInTheDocument()
  })

  it('reports Gurgaon pincodes as serviceable with a 24-hour ETA', async () => {
    const user = userEvent.setup()
    render(<PincodeChecker />)
    await user.type(screen.getByPlaceholderText('Enter pincode'), '122001')
    expect(await screen.findByText(/Delivery available in Gurgaon/)).toBeInTheDocument()
  })

  it('reports an out-of-range pincode as not serviceable', async () => {
    const user = userEvent.setup()
    render(<PincodeChecker />)
    await user.type(screen.getByPlaceholderText('Enter pincode'), '400001')
    expect(await screen.findByText('Not serviceable yet')).toBeInTheDocument()
  })

  it('strips non-digit characters and caps input at 6 digits', async () => {
    const user = userEvent.setup()
    render(<PincodeChecker />)
    const input = screen.getByPlaceholderText('Enter pincode') as HTMLInputElement
    await user.type(input, 'ab110044extra')
    expect(input.value).toBe('110044')
  })

  it('disables the Check button until 6 digits are entered', async () => {
    const user = userEvent.setup()
    render(<PincodeChecker />)
    const button = screen.getByRole('button', { name: 'Check' })
    expect(button).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Enter pincode'), '11004')
    expect(button).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Enter pincode'), '4')
    expect(button).not.toBeDisabled()
  })

  it('clears the result when the input is edited back below 6 digits', async () => {
    const user = userEvent.setup()
    render(<PincodeChecker />)
    const input = screen.getByPlaceholderText('Enter pincode')
    await user.type(input, '110044')
    expect(await screen.findByText(/Delivery available/)).toBeInTheDocument()

    await user.type(input, '{backspace}')
    expect(screen.queryByText(/Delivery available/)).not.toBeInTheDocument()
  })
})
