import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { returnApi, adminReturnApi } from './returnApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('returnApi', () => {
  it('request posts reason, note, and items', async () => {
    mock.onPost('/orders/o1/return-request').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body).toEqual({
        reason: 'damaged_or_spoiled',
        note: 'Arrived spoiled',
        items: [{ productId: 'p1', quantity: 1 }],
      })
      return [200, { success: true, data: { id: 'r1', status: 'requested' } }]
    })
    const result = await returnApi.request('o1', 'damaged_or_spoiled', 'Arrived spoiled', [{ productId: 'p1', quantity: 1 }])
    expect(result.id).toBe('r1')
  })

  it('getForOrder returns the record when one exists', async () => {
    mock.onGet('/orders/o1/return-request').reply(200, { success: true, data: { id: 'r1', status: 'requested' } })
    const result = await returnApi.getForOrder('o1')
    expect(result?.id).toBe('r1')
  })

  it('getForOrder returns null on a 404 (no request yet)', async () => {
    mock.onGet('/orders/o1/return-request').reply(404, { detail: 'No return request found for this order.' })
    const result = await returnApi.getForOrder('o1')
    expect(result).toBeNull()
  })

  it('getForOrder rethrows non-404 errors', async () => {
    mock.onGet('/orders/o1/return-request').reply(500, { detail: 'Server error' })
    await expect(returnApi.getForOrder('o1')).rejects.toBeTruthy()
  })
})

describe('adminReturnApi', () => {
  it('list passes status/search/page as query params', async () => {
    mock.onGet('/admin/returns').reply((config) => {
      expect(config.params).toEqual({ status: 'requested', search: 'DF-001', page: 1, limit: 20 })
      return [200, { data: [], total: 0, page: 1, totalPages: 0 }]
    })
    const result = await adminReturnApi.list('requested', 'DF-001', 1)
    expect(result.total).toBe(0)
  })

  it('approve puts an optional note', async () => {
    mock.onPut('/admin/returns/r1/approve').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ note: 'Confirmed damaged' })
      return [200, { success: true, data: { id: 'r1', status: 'refunded' } }]
    })
    const result = await adminReturnApi.approve('r1', 'Confirmed damaged')
    expect(result.status).toBe('refunded')
  })

  it('approveManual puts a reference and optional note', async () => {
    mock.onPut('/admin/returns/r1/approve-manual').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ reference: 'UTR123456', note: 'Bank transfer' })
      return [200, { success: true, data: { id: 'r1', status: 'refunded', refundMethod: 'manual' } }]
    })
    const result = await adminReturnApi.approveManual('r1', 'UTR123456', 'Bank transfer')
    expect(result.refundMethod).toBe('manual')
  })

  it('reject puts the required note', async () => {
    mock.onPut('/admin/returns/r1/reject').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ note: 'Not eligible' })
      return [200, { success: true, data: { id: 'r1', status: 'rejected' } }]
    })
    const result = await adminReturnApi.reject('r1', 'Not eligible')
    expect(result.status).toBe('rejected')
  })
})
