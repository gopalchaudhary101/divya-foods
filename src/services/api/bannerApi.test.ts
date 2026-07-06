import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { bannerApi } from './bannerApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('bannerApi', () => {
  it('getActive fetches /banners and unwraps the list', async () => {
    mock.onGet('/banners').reply(200, { success: true, data: [{ id: 'b1', title: 'Sale' }] })
    const result = await bannerApi.getActive()
    expect(result[0].title).toBe('Sale')
  })
})
