import { describe, it, expect } from 'vitest'
import reducer, { addToWishlist, removeFromWishlist, toggleWishlist } from './wishlistSlice'

describe('wishlistSlice', () => {
  it('starts empty', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state.productIds).toEqual([])
  })

  it('adds a product', () => {
    const state = reducer(undefined, addToWishlist('p1'))
    expect(state.productIds).toEqual(['p1'])
  })

  it('does not add the same product twice', () => {
    let state = reducer(undefined, addToWishlist('p1'))
    state = reducer(state, addToWishlist('p1'))
    expect(state.productIds).toEqual(['p1'])
  })

  it('removes a product', () => {
    let state = reducer(undefined, addToWishlist('p1'))
    state = reducer(state, removeFromWishlist('p1'))
    expect(state.productIds).toEqual([])
  })

  it('removing a product not in the list is a no-op', () => {
    const state = reducer(undefined, removeFromWishlist('nope'))
    expect(state.productIds).toEqual([])
  })

  it('toggle adds when absent', () => {
    const state = reducer(undefined, toggleWishlist('p1'))
    expect(state.productIds).toEqual(['p1'])
  })

  it('toggle removes when present', () => {
    let state = reducer(undefined, addToWishlist('p1'))
    state = reducer(state, toggleWishlist('p1'))
    expect(state.productIds).toEqual([])
  })
})
