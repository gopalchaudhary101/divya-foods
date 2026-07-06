import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeliveryStatusStepper } from './DeliveryStatusStepper'

describe('DeliveryStatusStepper', () => {
  it('shows a cancelled banner for cancelled orders, hiding the step list', () => {
    render(<DeliveryStatusStepper status="cancelled" />)
    expect(screen.getByText('Order Cancelled')).toBeInTheDocument()
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument()
  })

  it('renders all five steps for an in-progress order', () => {
    render(<DeliveryStatusStepper status="processing" />)
    ;['Order Placed', 'Confirmed', 'Processing', 'Shipped', 'Delivered'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  it('defaults to the first step for an unrecognized status', () => {
    render(<DeliveryStatusStepper status="unknown-status" />)
    expect(screen.getByText('Order Placed')).toBeInTheDocument()
  })
})
