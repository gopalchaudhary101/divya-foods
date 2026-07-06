import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom does not implement scrollIntoView — stub it so components that call it
// (keyboard-navigable lists, modals, etc.) don't crash in tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom does not implement IntersectionObserver — framer-motion's `whileInView`
// (used throughout the Home page sections) needs it just to mount without throwing.
if (!('IntersectionObserver' in globalThis)) {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }
  // @ts-expect-error - partial polyfill, sufficient for tests
  globalThis.IntersectionObserver = MockIntersectionObserver
}

// Explicit unmount + DOM cleanup between tests. Without this, multiple renders
// in the same file accumulate in the DOM and label/role queries that should be
// unique start matching more than one element.
afterEach(() => {
  cleanup()
})

