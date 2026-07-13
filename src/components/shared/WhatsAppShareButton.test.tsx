import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import { WhatsAppShareButton } from './WhatsAppShareButton'
import { whatsappApi } from '@/services/api/whatsappApi'

vi.mock('@/services/api/whatsappApi', () => ({
  whatsappApi: { getConfig: vi.fn(), trackShare: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('open', vi.fn())
})

describe('WhatsAppShareButton', () => {
  it('renders nothing while config is disabled', async () => {
    vi.mocked(whatsappApi.getConfig).mockResolvedValue({
      enabled: false, phoneNumber: '', productMessageTemplate: '', cartMessageTemplate: '', orderMessageTemplate: '',
    })
    renderWithProviders(<WhatsAppShareButton message="Hi" source="product_card" />)
    await waitFor(() => expect(whatsappApi.getConfig).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing when enabled but no phone number is configured', async () => {
    vi.mocked(whatsappApi.getConfig).mockResolvedValue({
      enabled: true, phoneNumber: '', productMessageTemplate: '', cartMessageTemplate: '', orderMessageTemplate: '',
    })
    renderWithProviders(<WhatsAppShareButton message="Hi" source="product_card" />)
    await waitFor(() => expect(whatsappApi.getConfig).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('opens wa.me with the encoded message and tracks each product on click', async () => {
    vi.mocked(whatsappApi.getConfig).mockResolvedValue({
      enabled: true, phoneNumber: '919999123242', productMessageTemplate: '', cartMessageTemplate: '', orderMessageTemplate: '',
    })
    vi.mocked(whatsappApi.trackShare).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(
      <WhatsAppShareButton
        message="Check out this Salmon!"
        source="product_detail"
        trackItems={[{ productId: 'p1', productName: 'Salmon' }]}
      />
    )

    const button = await screen.findByRole('button', { name: 'Share on WhatsApp' })
    await user.click(button)

    expect(window.open).toHaveBeenCalledWith(
      'https://wa.me/919999123242?text=Check%20out%20this%20Salmon!',
      '_blank',
      'noopener,noreferrer',
    )
    expect(whatsappApi.trackShare).toHaveBeenCalledWith({ productId: 'p1', productName: 'Salmon', source: 'product_detail' })
  })

  it('tracks every item for a multi-product share (cart)', async () => {
    vi.mocked(whatsappApi.getConfig).mockResolvedValue({
      enabled: true, phoneNumber: '919999123242', productMessageTemplate: '', cartMessageTemplate: '', orderMessageTemplate: '',
    })
    vi.mocked(whatsappApi.trackShare).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(
      <WhatsAppShareButton
        message="Cart summary"
        source="cart"
        trackItems={[
          { productId: 'p1', productName: 'Salmon' },
          { productId: 'p2', productName: 'Tuna' },
        ]}
      />
    )

    await user.click(await screen.findByRole('button'))
    expect(whatsappApi.trackShare).toHaveBeenCalledTimes(2)
  })

  it('renders a compact icon-only button when compact is set', async () => {
    vi.mocked(whatsappApi.getConfig).mockResolvedValue({
      enabled: true, phoneNumber: '919999123242', productMessageTemplate: '', cartMessageTemplate: '', orderMessageTemplate: '',
    })
    renderWithProviders(<WhatsAppShareButton compact message="Hi" source="product_card" />)
    const button = await screen.findByRole('button', { name: 'Share on WhatsApp' })
    expect(button).toHaveClass('rounded-full')
  })
})
