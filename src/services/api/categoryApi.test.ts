import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { categoryApi } from './categoryApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('categoryApi', () => {
  it('getAll unwraps the category list', async () => {
    mock.onGet('/categories').reply(200, { success: true, data: [{ id: 'c1', name: 'Seafood' }] })
    const result = await categoryApi.getAll()
    expect(result[0].name).toBe('Seafood')
  })

  it('getBySlug fetches the slug-scoped URL', async () => {
    mock.onGet('/categories/seafood').reply(200, { success: true, data: { id: 'c1', name: 'Seafood' } })
    const category = await categoryApi.getBySlug('seafood')
    expect(category.id).toBe('c1')
  })
})
