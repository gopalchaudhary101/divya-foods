import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { couponApi, adminCouponApi } from './couponApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('couponApi', () => {
  it('validate uppercases the code and posts order_amount', async () => {
    mock.onPost('/coupons/validate').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body).toEqual({ code: 'SAVE10', order_amount: 500 })
      return [200, { success: true, data: { valid: true, discountAmount: 50, message: 'ok' } }]
    })
    const result = await couponApi.validate('save10', 500)
    expect(result.valid).toBe(true)
  })
})

describe('adminCouponApi', () => {
  it('list unwraps the coupon array', async () => {
    mock.onGet('/admin/coupons').reply(200, { success: true, data: [] })
    await expect(adminCouponApi.list()).resolves.toEqual([])
  })

  it('create posts the upsert payload', async () => {
    mock.onPost('/admin/coupons').reply(200, { success: true, data: { id: 'c1' } })
    await expect(adminCouponApi.create({
      code: 'NEW10', discountType: 'flat', discountValue: 10, minOrderValue: 0, isActive: true,
    })).resolves.toEqual({ id: 'c1' })
  })

  it('update PUTs to the coupon-scoped URL', async () => {
    mock.onPut('/admin/coupons/c1').reply(200, { success: true, data: { id: 'c1' } })
    await expect(adminCouponApi.update('c1', {
      code: 'NEW10', discountType: 'flat', discountValue: 10, minOrderValue: 0, isActive: true,
    })).resolves.toEqual({ id: 'c1' })
  })

  it('delete DELETEs the coupon-scoped URL', async () => {
    mock.onDelete('/admin/coupons/c1').reply(204)
    await expect(adminCouponApi.delete('c1')).resolves.toBeUndefined()
  })
})
