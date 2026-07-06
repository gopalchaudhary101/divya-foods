import { describe, it, expect, beforeEach } from 'vitest'
import reducer, { toggleDarkMode, toggleMobileMenu, setCartOpen, setSearchOpen } from './uiSlice'

describe('uiSlice', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('starts with everything closed and light mode', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state).toEqual({
      isDarkMode: false,
      isMobileMenuOpen: false,
      isCartOpen: false,
      isSearchOpen: false,
    })
  })

  it('toggleDarkMode flips the flag and syncs the <html> class', () => {
    let state = reducer(undefined, toggleDarkMode())
    expect(state.isDarkMode).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    state = reducer(state, toggleDarkMode())
    expect(state.isDarkMode).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggleMobileMenu flips the flag', () => {
    let state = reducer(undefined, toggleMobileMenu())
    expect(state.isMobileMenuOpen).toBe(true)
    state = reducer(state, toggleMobileMenu())
    expect(state.isMobileMenuOpen).toBe(false)
  })

  it('setCartOpen sets the flag explicitly', () => {
    const state = reducer(undefined, setCartOpen(true))
    expect(state.isCartOpen).toBe(true)
  })

  it('setSearchOpen sets the flag explicitly', () => {
    const state = reducer(undefined, setSearchOpen(true))
    expect(state.isSearchOpen).toBe(true)
  })
})
