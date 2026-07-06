import { describe, it, expect } from 'vitest'
import { useRef, useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFocusTrap } from './useFocusTrap'

function TrapHarness({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, active)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('#first')?.focus()
  }, [])
  return (
    <div ref={ref}>
      <button id="first">First</button>
      <button id="middle">Middle</button>
      <button id="last">Last</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('wraps focus from the last element back to the first on Tab', async () => {
    const user = userEvent.setup()
    render(<TrapHarness active />)

    screen.getByText('Last').focus()
    await user.tab()

    expect(screen.getByText('First')).toHaveFocus()
  })

  it('wraps focus from the first element back to the last on Shift+Tab', async () => {
    const user = userEvent.setup()
    render(<TrapHarness active />)

    screen.getByText('First').focus()
    await user.tab({ shift: true })

    expect(screen.getByText('Last')).toHaveFocus()
  })

  it('does nothing when inactive', async () => {
    const user = userEvent.setup()
    render(<TrapHarness active={false} />)

    screen.getByText('Last').focus()
    await user.tab()

    // No trap → focus leaves the container entirely (goes to <body>)
    expect(screen.getByText('Last')).not.toHaveFocus()
    expect(screen.getByText('First')).not.toHaveFocus()
  })
})
