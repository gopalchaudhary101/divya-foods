import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { reviewApi } from './reviewApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('reviewApi', () => {
  it('getByProduct sends page + limit params', async () => {
    mock.onGet('/reviews/p1').reply((config) => {
      expect(config.params).toEqual({ page: 1, limit: 10 })
      return [200, { success: true, data: [], total: 0, page: 1, totalPages: 0 }]
    })
    await reviewApi.getByProduct('p1')
  })

  it('canReview unwraps the eligibility response', async () => {
    mock.onGet('/reviews/can-review/p1').reply(200, {
      success: true, data: { canReview: false, reason: 'no_purchase' },
    })
    const result = await reviewApi.canReview('p1')
    expect(result.reason).toBe('no_purchase')
  })

  it('create converts productId to product_id for the backend contract', async () => {
    mock.onPost('/reviews').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body).toEqual({ product_id: 'p1', rating: 5, comment: 'Great!' })
      return [200, { success: true, data: { id: 'r1', rating: 5 } }]
    })
    const review = await reviewApi.create({ productId: 'p1', rating: 5, comment: 'Great!' })
    expect(review.id).toBe('r1')
  })

  it('delete DELETEs the review-scoped URL', async () => {
    mock.onDelete('/reviews/r1').reply(200)
    await expect(reviewApi.delete('r1')).resolves.toBeUndefined()
  })
})
