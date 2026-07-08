import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import MockAdapter from 'axios-mock-adapter'
import axiosInstance from './axiosInstance'
import { orderApi } from './orderApi'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => mock.reset())
afterAll(() => mock.restore())

const address = {
  label: 'Home', fullName: 'A', phone: '999', addressLine1: 'Street 1',
  city: 'Delhi', state: 'Delhi', pincode: '110001',
}
const items = [{ productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: null, maxQuantity: 5 }]

describe('orderApi', () => {
  it('initiate converts camelCase address/items into the snake_case API contract', async () => {
    mock.onPost('/orders').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body.delivery_address.full_name).toBe('A')
      expect(body.delivery_address.address_line1).toBe('Street 1')
      expect(body.items[0].productId).toBe('p1')
      expect(body.coupon_code).toBeNull()
      return [200, { success: true, data: { orderId: 'o1', razorpayOrderId: 'rzp1' } }]
    })
    const result = await orderApi.initiate(address, items)
    expect(result.orderId).toBe('o1')
  })

  it('initiate passes through a coupon code when given', async () => {
    mock.onPost('/orders').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body.coupon_code).toBe('SAVE10')
      return [200, { success: true, data: {} }]
    })
    await orderApi.initiate(address, items, 'SAVE10')
  })

  it('verifyPayment posts the razorpay verification fields', async () => {
    mock.onPost('/orders/verify').reply((config) => {
      const body = JSON.parse(config.data)
      expect(body).toEqual({
        order_id: 'o1',
        razorpay_order_id: 'rzp1',
        razorpay_payment_id: 'pay1',
        razorpay_signature: 'sig1',
      })
      return [200, { success: true, data: { id: 'o1', status: 'confirmed' } }]
    })
    const order = await orderApi.verifyPayment('o1', 'rzp1', 'pay1', 'sig1')
    expect(order.status).toBe('confirmed')
  })

  it('getMyOrders passes the page as a query string', async () => {
    // Real backend shape: total/page/totalPages are siblings of data, not nested
    // inside it — regression coverage for a bug where getMyOrders() read .data off
    // the bare order array (always undefined), silently emptying "My Orders" for
    // every customer regardless of how many orders they actually had.
    mock.onGet('/orders?page=2').reply(200, { success: true, data: [{ id: 'o1' }], total: 1, page: 2, totalPages: 1 })
    const result = await orderApi.getMyOrders(2)
    expect(result.page).toBe(2)
    expect(result.data).toEqual([{ id: 'o1' }])
    expect(result.total).toBe(1)
  })

  it('getById fetches the order-scoped URL', async () => {
    mock.onGet('/orders/o1').reply(200, { success: true, data: { id: 'o1' } })
    const order = await orderApi.getById('o1')
    expect(order.id).toBe('o1')
  })
})
