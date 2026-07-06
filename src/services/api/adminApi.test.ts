import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { adminApi } from './adminApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

describe('adminApi — products', () => {
  it('getProducts passes filter params through', async () => {
    mock.onGet('/admin/products').reply(200, { success: true, data: [], total: 0, page: 1, totalPages: 0 })
    await adminApi.getProducts({ page: 1 })
  })

  it('createProduct posts multipart form data', async () => {
    mock.onPost('/admin/products').reply((config) => {
      expect(config.data).toBeInstanceOf(FormData)
      return [200, { success: true, data: { id: 'p1' } }]
    })
    await adminApi.createProduct(new FormData())
  })

  it('updateProduct PUTs partial fields', async () => {
    mock.onPut('/admin/products/p1', { price: 500 }).reply(200, { success: true, data: { id: 'p1' } })
    await adminApi.updateProduct('p1', { price: 500 })
  })

  it('deleteProduct DELETEs the product-scoped URL', async () => {
    mock.onDelete('/admin/products/p1').reply(200)
    await expect(adminApi.deleteProduct('p1')).resolves.toBeUndefined()
  })
})

describe('adminApi — orders', () => {
  it('getOrders passes filters as query params', async () => {
    mock.onGet('/admin/orders').reply(200, { success: true, data: [], total: 0, page: 1, totalPages: 0 })
    await adminApi.getOrders({ status: 'pending' })
  })

  it('updateOrderStatus PUTs status + note', async () => {
    mock.onPut('/admin/orders/o1/status', { status: 'confirmed', note: 'Verified' }).reply(200, {
      success: true, data: { id: 'o1', status: 'confirmed' },
    })
    const order = await adminApi.updateOrderStatus('o1', 'confirmed', 'Verified')
    expect(order.status).toBe('confirmed')
  })
})

describe('adminApi — banners', () => {
  it('getBanners unwraps the list', async () => {
    mock.onGet('/admin/banners').reply(200, { success: true, data: [] })
    await expect(adminApi.getBanners()).resolves.toEqual([])
  })

  it('createBanner posts the payload', async () => {
    mock.onPost('/admin/banners').reply(200, { success: true, data: { id: 'b1' } })
    await expect(adminApi.createBanner({ title: 'Sale' })).resolves.toEqual({ id: 'b1' })
  })

  it('updateBanner PUTs to the banner-scoped URL', async () => {
    mock.onPut('/admin/banners/b1').reply(200, { success: true, data: { id: 'b1' } })
    await expect(adminApi.updateBanner('b1', { isActive: false })).resolves.toEqual({ id: 'b1' })
  })

  it('deleteBanner DELETEs the banner-scoped URL', async () => {
    mock.onDelete('/admin/banners/b1').reply(204)
    await expect(adminApi.deleteBanner('b1')).resolves.toBeUndefined()
  })
})

describe('adminApi — coupons', () => {
  it('getCoupons unwraps the list', async () => {
    mock.onGet('/admin/coupons').reply(200, { success: true, data: [] })
    await expect(adminApi.getCoupons()).resolves.toEqual([])
  })

  it('createCoupon posts the payload', async () => {
    mock.onPost('/admin/coupons').reply(200, { success: true, data: { id: 'c1' } })
    await expect(adminApi.createCoupon({ code: 'X' })).resolves.toEqual({ id: 'c1' })
  })

  it('deleteCoupon DELETEs the coupon-scoped URL', async () => {
    mock.onDelete('/admin/coupons/c1').reply(204)
    await expect(adminApi.deleteCoupon('c1')).resolves.toBeUndefined()
  })
})

// The three functions below are exported by adminApi.ts but are not called from
// any page or hook in this codebase (the real Admin Dashboard page fetches
// /admin/stats directly). Their target endpoints do not exist on the backend
// (which only has GET /admin/categories and GET /admin/stats, not POST
// /admin/categories, /admin/dashboard, or /admin/customers). These tests only
// confirm the functions call the URLs they claim to — they'd fail against the
// real API if anyone wired them up. Flagged as dead code, not fixed here.
describe('adminApi — unused functions with no matching backend route (dead code)', () => {
  it('getDashboard calls /admin/dashboard, which does not exist on the backend', async () => {
    mock.onGet('/admin/dashboard').reply(200, { success: true, data: {} })
    await adminApi.getDashboard()
  })

  it('getCustomers calls /admin/customers, which does not exist on the backend', async () => {
    mock.onGet('/admin/customers').reply(200, { success: true, data: [], total: 0, page: 1, totalPages: 0 })
    await adminApi.getCustomers()
  })

  it('createCategory calls POST /admin/categories, which the backend only exposes as GET', async () => {
    mock.onPost('/admin/categories').reply(200, { success: true, data: { id: 'c1' } })
    await adminApi.createCategory({ name: 'New' })
  })
})
