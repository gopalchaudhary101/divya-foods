import { describe, it, expect } from 'vitest'
import reducer, { addToCart, updateQuantity, removeFromCart, clearCart } from './cartSlice'
import type { CartItem } from '@/types'

const salmon: CartItem = {
  productId: 'p1',
  name: 'Norwegian Salmon',
  price: 999,
  quantity: 1,
  maxQuantity: 5,
  image: '/salmon.webp',
}

describe('cartSlice', () => {
  it('starts empty', () => {
    const state = reducer(undefined, { type: '@@INIT' })
    expect(state).toEqual({ items: [], totalItems: 0, totalPrice: 0 })
  })

  it('adds a new item and recalculates totals', () => {
    const state = reducer(undefined, addToCart(salmon))
    expect(state.items).toHaveLength(1)
    expect(state.totalItems).toBe(1)
    expect(state.totalPrice).toBe(999)
  })

  it('increments quantity when adding an item already in the cart', () => {
    let state = reducer(undefined, addToCart(salmon))
    state = reducer(state, addToCart({ ...salmon, quantity: 2 }))
    expect(state.items).toHaveLength(1)
    expect(state.items[0].quantity).toBe(3)
    expect(state.totalPrice).toBe(999 * 3)
  })

  it('caps quantity at maxQuantity when adding more than the limit', () => {
    let state = reducer(undefined, addToCart(salmon))
    state = reducer(state, addToCart({ ...salmon, quantity: 10 }))
    expect(state.items[0].quantity).toBe(5)
  })

  it('updates quantity directly, capped at maxQuantity', () => {
    let state = reducer(undefined, addToCart(salmon))
    state = reducer(state, updateQuantity({ productId: 'p1', quantity: 3 }))
    expect(state.items[0].quantity).toBe(3)

    state = reducer(state, updateQuantity({ productId: 'p1', quantity: 99 }))
    expect(state.items[0].quantity).toBe(5)
  })

  it('removes an item and recalculates totals', () => {
    let state = reducer(undefined, addToCart(salmon))
    state = reducer(state, removeFromCart('p1'))
    expect(state.items).toHaveLength(0)
    expect(state.totalItems).toBe(0)
    expect(state.totalPrice).toBe(0)
  })

  it('clears the entire cart', () => {
    let state = reducer(undefined, addToCart(salmon))
    state = reducer(state, addToCart({ ...salmon, productId: 'p2' }))
    state = reducer(state, clearCart())
    expect(state).toEqual({ items: [], totalItems: 0, totalPrice: 0 })
  })

  it('tracks multiple distinct items independently', () => {
    let state = reducer(undefined, addToCart(salmon))
    state = reducer(state, addToCart({ ...salmon, productId: 'p2', price: 500, quantity: 2 }))
    expect(state.items).toHaveLength(2)
    expect(state.totalItems).toBe(3)
    expect(state.totalPrice).toBe(999 + 1000)
  })
})
