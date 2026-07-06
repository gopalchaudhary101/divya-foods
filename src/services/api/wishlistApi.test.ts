import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { wishlistApi } from './wishlistApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('wishlistApi', () => {
  it('getWishlist fetches /users/wishlist and unwraps the product list', async () => {
    mock.onGet('/users/wishlist').reply(200, { success: true, data: [{ id: 'p1', name: 'Salmon' }] })
    const result = await wishlistApi.getWishlist()
    expect(result[0].name).toBe('Salmon')
  })

  it('addToWishlist posts the product_id', async () => {
    mock.onPost('/users/wishlist', { product_id: 'p1' }).reply(200)
    await expect(wishlistApi.addToWishlist('p1')).resolves.toBeUndefined()
  })

  it('removeFromWishlist DELETEs the product-scoped URL', async () => {
    mock.onDelete('/users/wishlist/p1').reply(200)
    await expect(wishlistApi.removeFromWishlist('p1')).resolves.toBeUndefined()
  })
})
