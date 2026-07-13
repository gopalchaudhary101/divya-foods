import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminWhatsAppPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const config = {
  enabled: true,
  phoneNumber: '919999123242',
  productMessageTemplate: 'Hi {productName} {price}',
  cartMessageTemplate: 'Cart {itemsList} {total}',
  orderMessageTemplate: 'Order {orderNumber} {status} {total}',
  cloudApiConfigured: false,
}

const analytics = {
  totalShares: 12,
  bySource: [{ source: 'product_card', count: 8 }, { source: 'cart', count: 4 }],
  topProducts: [{ productId: 'p1', productName: 'Norwegian Salmon', count: 5 }],
}

beforeEach(() => {
  mock.reset()
  mock.onGet('/admin/whatsapp/config').reply(200, { success: true, data: config })
  mock.onGet('/admin/whatsapp/analytics').reply(200, { success: true, data: analytics })
})
afterAll(() => mock.restore())

describe('AdminWhatsAppPage', () => {
  it('loads and pre-fills the current config', async () => {
    renderWithProviders(<AdminWhatsAppPage />)
    expect(await screen.findByDisplayValue('919999123242')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hi {productName} {price}')).toBeInTheDocument()
  })

  it('shows total shares and top shared products', async () => {
    renderWithProviders(<AdminWhatsAppPage />)
    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(await screen.findByText('Norwegian Salmon')).toBeInTheDocument()
    expect(screen.getByText('5 shares')).toBeInTheDocument()
  })

  it('shows a cloud API setup hint when not configured', async () => {
    renderWithProviders(<AdminWhatsAppPage />)
    expect(await screen.findByText(/not configured/)).toBeInTheDocument()
  })

  it('saves updated config', async () => {
    mock.onPut('/admin/whatsapp/config').reply(200, {
      success: true, data: { ...config, phoneNumber: '918888123242' },
    })
    const user = userEvent.setup()
    renderWithProviders(<AdminWhatsAppPage />)

    const phoneInput = await screen.findByDisplayValue('919999123242')
    await user.clear(phoneInput)
    await user.type(phoneInput, '918888123242')
    await user.click(screen.getByRole('button', { name: /Save Settings/ }))

    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    const body = JSON.parse(mock.history.put[0].data)
    expect(body.phoneNumber).toBe('918888123242')
  })

  it('toggles the enabled switch', async () => {
    mock.onPut('/admin/whatsapp/config').reply(200, { success: true, data: { ...config, enabled: false } })
    const user = userEvent.setup()
    renderWithProviders(<AdminWhatsAppPage />)

    await screen.findByDisplayValue('919999123242')
    await user.click(screen.getByText('Enable "Share on WhatsApp" buttons sitewide'))
    await user.click(screen.getByRole('button', { name: /Save Settings/ }))

    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    const body = JSON.parse(mock.history.put[0].data)
    expect(body.enabled).toBe(false)
  })
})
