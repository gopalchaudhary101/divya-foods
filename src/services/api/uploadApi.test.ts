import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { uploadApi } from './uploadApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('uploadApi', () => {
  it('image sends multipart form data and returns the flattened result', async () => {
    mock.onPost('/upload/image').reply((config) => {
      expect(config.data).toBeInstanceOf(FormData)
      expect(config.headers?.['Content-Type']).toBe('multipart/form-data')
      return [200, { success: true, url: 'https://cdn/a.jpg', publicId: 'a', width: 800, height: 800 }]
    })
    const result = await uploadApi.image(new File(['x'], 'a.jpg'))
    expect(result).toEqual({ url: 'https://cdn/a.jpg', publicId: 'a', width: 800, height: 800 })
  })
})
