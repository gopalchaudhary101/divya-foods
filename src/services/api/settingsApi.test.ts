import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { settingsApi, adminSettingsApi } from './settingsApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

const settings = { businessName: 'Divya Luxury Seafoods', gstNumber: 'GSTIN123', fssaiNumber: 'FSSAI456' }

describe('settingsApi', () => {
  it('get fetches /settings and unwraps the payload', async () => {
    mock.onGet('/settings').reply(200, { success: true, data: settings })
    const result = await settingsApi.get()
    expect(result.gstNumber).toBe('GSTIN123')
  })
})

describe('adminSettingsApi', () => {
  it('get fetches /admin/settings', async () => {
    mock.onGet('/admin/settings').reply(200, { success: true, data: settings })
    const result = await adminSettingsApi.get()
    expect(result.businessName).toBe('Divya Luxury Seafoods')
  })

  it('update PUTs the partial payload to /admin/settings', async () => {
    mock.onPut('/admin/settings').reply(200, { success: true, data: { ...settings, gstNumber: 'NEW123' } })
    const result = await adminSettingsApi.update({ gstNumber: 'NEW123' })
    expect(result.gstNumber).toBe('NEW123')
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ gstNumber: 'NEW123' })
  })
})
