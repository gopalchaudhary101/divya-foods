import { describe, it, expect } from 'vitest'
import { renderWithProviders, screen } from './testUtils'

function Probe() {
  return <div>hello world</div>
}

describe('renderWithProviders smoke test', () => {
  it('renders a component wrapped in all app providers without crashing', () => {
    renderWithProviders(<Probe />)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('accepts preloaded redux state', () => {
    renderWithProviders(<Probe />, {
      preloadedState: { cart: { items: [], totalItems: 3, totalPrice: 500 } },
    })
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })
})
