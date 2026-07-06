import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { cartApi, type CartItemData } from './cartApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

const item: CartItemData = {
  productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: null, maxQuantity: 5,
}

describe('cartApi', () => {
  it('getCart unwraps ApiResponse', async () => {
    mock.onGet('/cart').reply(200, { success: true, data: { items: [], totalItems: 0, totalPrice: 0 } })
    const cart = await cartApi.getCart()
    expect(cart.totalItems).toBe(0)
  })

  it('syncCart posts the items array', async () => {
    mock.onPost('/cart/sync', { items: [item] }).reply(200)
    await expect(cartApi.syncCart([item])).resolves.toBeUndefined()
  })

  it('addItem posts the full item and returns updated cart', async () => {
    mock.onPost('/cart/items', item).reply(200, {
      success: true, data: { items: [item], totalItems: 1, totalPrice: 999 },
    })
    const cart = await cartApi.addItem(item)
    expect(cart.totalItems).toBe(1)
  })

  it('updateItem PUTs to the product-scoped URL with the new quantity', async () => {
    mock.onPut('/cart/items/p1', { quantity: 3 }).reply(200, {
      success: true, data: { items: [], totalItems: 3, totalPrice: 2997 },
    })
    const cart = await cartApi.updateItem('p1', 3)
    expect(cart.totalPrice).toBe(2997)
  })

  it('removeItem DELETEs the product-scoped URL', async () => {
    mock.onDelete('/cart/items/p1').reply(200, {
      success: true, data: { items: [], totalItems: 0, totalPrice: 0 },
    })
    const cart = await cartApi.removeItem('p1')
    expect(cart.items).toEqual([])
  })

  it('clearCart DELETEs /cart', async () => {
    mock.onDelete('/cart').reply(204)
    await expect(cartApi.clearCart()).resolves.toBeUndefined()
  })
})
