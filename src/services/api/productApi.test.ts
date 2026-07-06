import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { productApi } from './productApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('productApi', () => {
  it('getList passes filters as query params and returns the paginated envelope', async () => {
    mock.onGet('/products').reply((config) => {
      expect(config.params).toEqual({ page: 2, category: 'seafood' })
      return [200, { success: true, data: [], total: 0, page: 2, totalPages: 0 }]
    })
    const result = await productApi.getList({ page: 2, category: 'seafood' })
    expect(result.page).toBe(2)
  })

  it('getBySlug fetches the slug-scoped URL and unwraps ApiResponse', async () => {
    mock.onGet('/products/salmon').reply(200, { success: true, data: { id: 'p1', name: 'Salmon' } })
    const product = await productApi.getBySlug('salmon')
    expect(product.name).toBe('Salmon')
  })

  it('getFeatured hits /products/featured', async () => {
    mock.onGet('/products/featured').reply(200, { success: true, data: [{ id: 'p1' }] })
    const result = await productApi.getFeatured()
    expect(result).toHaveLength(1)
  })

  it('getBestSellers hits /products/best-sellers', async () => {
    mock.onGet('/products/best-sellers').reply(200, { success: true, data: [] })
    await expect(productApi.getBestSellers()).resolves.toEqual([])
  })

  it('search sends the query as ?q=', async () => {
    mock.onGet('/products/search').reply((config) => {
      expect(config.params).toEqual({ q: 'salmon' })
      return [200, { success: true, data: [] }]
    })
    await productApi.search('salmon')
  })

  it('getRelated hits the product-scoped related URL', async () => {
    mock.onGet('/products/p1/related').reply(200, { success: true, data: [] })
    await expect(productApi.getRelated('p1')).resolves.toEqual([])
  })

  it('getSuggestions sends q and limit params', async () => {
    mock.onGet('/products/suggestions').reply((config) => {
      expect(config.params).toEqual({ q: 'sal', limit: 6 })
      return [200, { success: true, data: [] }]
    })
    await productApi.getSuggestions('sal')
  })
})
