import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { FishCursor } from './FishCursor'

function mockPointer(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(), // deprecated API — framer-motion's reduced-motion detection still uses it
      removeListener: vi.fn(),
    })),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FishCursor', () => {
  it('renders nothing on touch-only devices (no fine pointer)', () => {
    mockPointer(false)
    const { container } = render(<FishCursor />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the fish on devices with a real mouse', () => {
    mockPointer(true)
    const { container } = render(<FishCursor />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('is purely decorative — hidden from assistive tech', () => {
    mockPointer(true)
    const { container } = render(<FishCursor />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})
