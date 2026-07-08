import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { userApi } from './userApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('userApi', () => {
  it('getProfile unwraps ApiResponse', async () => {
    mock.onGet('/users/profile').reply(200, { success: true, data: { id: 'u1', name: 'A' } })
    const user = await userApi.getProfile()
    expect(user.name).toBe('A')
  })

  it('updateProfile PUTs the partial payload', async () => {
    mock.onPut('/users/profile', { name: 'New Name' }).reply(200, {
      success: true, data: { id: 'u1', name: 'New Name' },
    })
    const user = await userApi.updateProfile({ name: 'New Name' })
    expect(user.name).toBe('New Name')
  })

  it('uploadAvatar sends multipart form data and returns the updated user', async () => {
    mock.onPost('/users/avatar').reply((config) => {
      expect(config.data).toBeInstanceOf(FormData)
      return [200, { success: true, data: { id: 'u1', name: 'A', avatar: 'https://cdn/avatar.jpg' } }]
    })
    const user = await userApi.uploadAvatar(new File(['x'], 'avatar.jpg'))
    expect(user.avatar).toBe('https://cdn/avatar.jpg')
  })

  it('getAddresses unwraps the list', async () => {
    mock.onGet('/users/addresses').reply(200, { success: true, data: [] })
    await expect(userApi.getAddresses()).resolves.toEqual([])
  })

  it('addAddress converts camelCase fields to the backend snake_case contract', async () => {
    mock.onPost('/users/addresses').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body.full_name).toBe('A')
      expect(body.address_line1).toBe('Street 1')
      expect(body.is_default).toBe(true)
      return [200, { success: true, data: { id: 'a1' } }]
    })
    await userApi.addAddress({
      label: 'Home', fullName: 'A', phone: '999', addressLine1: 'Street 1',
      city: 'Delhi', state: 'Delhi', pincode: '110001', isDefault: true,
    })
  })

  it('updateAddress PUTs to the address-scoped URL', async () => {
    mock.onPut('/users/addresses/a1').reply(200, { success: true, data: { id: 'a1' } })
    await expect(userApi.updateAddress('a1', { city: 'Gurgaon' })).resolves.toEqual({ id: 'a1' })
  })

  it('deleteAddress DELETEs the address-scoped URL', async () => {
    mock.onDelete('/users/addresses/a1').reply(204)
    await expect(userApi.deleteAddress('a1')).resolves.toBeUndefined()
  })

  it('setDefaultAddress PUTs to the default sub-route', async () => {
    mock.onPut('/users/addresses/a1/default').reply(200)
    await expect(userApi.setDefaultAddress('a1')).resolves.toBeUndefined()
  })
})
