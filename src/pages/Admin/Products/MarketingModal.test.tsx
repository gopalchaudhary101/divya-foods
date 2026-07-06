import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import { MarketingModal } from './MarketingModal'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const content = {
  seoTitle: 'Norwegian Salmon | Buy Online at Divya Luxury Seafoods',
  seoDescription: 'Shop Norwegian Salmon online at Divya Luxury Seafoods. Fast delivery across Delhi NCR.',
  caption: 'Fresh Norwegian Salmon now available!',
  hashtags: ['#DivyaFoods', '#PremiumSeafood'],
  productUrl: 'https://divya-foods.vercel.app/products/norwegian-salmon',
}

let writeTextSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  mock.reset()
  // jsdom's Clipboard support is inconsistent across environments/versions — some provide
  // a real navigator.clipboard to spy on, others provide none at all. Handle both.
  if (navigator.clipboard) {
    writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined) as ReturnType<typeof vi.fn>
  } else {
    writeTextSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    })
  }
})
afterAll(() => mock.restore())

describe('MarketingModal', () => {
  it('generates and displays marketing content', async () => {
    mock.onPost('/admin/products/p1/marketing').reply(200, { success: true, data: content })
    const user = userEvent.setup()
    renderWithProviders(<MarketingModal productId="p1" productName="Norwegian Salmon" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Generate Marketing Content' }))

    expect(await screen.findByDisplayValue(content.seoTitle)).toBeInTheDocument()
    expect(screen.getByDisplayValue(content.caption)).toBeInTheDocument()
    expect(screen.getByDisplayValue('#DivyaFoods #PremiumSeafood')).toBeInTheDocument()
  })

  it('builds correct share links once content is generated', async () => {
    mock.onPost('/admin/products/p1/marketing').reply(200, { success: true, data: content })
    const user = userEvent.setup()
    renderWithProviders(<MarketingModal productId="p1" productName="Norwegian Salmon" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Generate Marketing Content' }))
    await screen.findByDisplayValue(content.seoTitle)

    const fbLink = screen.getByRole('link', { name: /Facebook/ })
    expect(fbLink).toHaveAttribute('href', expect.stringContaining('facebook.com/sharer'))
    expect(fbLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent(content.productUrl)))

    const waLink = screen.getByRole('link', { name: /WhatsApp/ })
    expect(waLink).toHaveAttribute('href', expect.stringContaining('wa.me'))

    const liLink = screen.getByRole('link', { name: /LinkedIn/ })
    expect(liLink).toHaveAttribute('href', expect.stringContaining('linkedin.com/sharing'))
  })

  it('copies caption to clipboard for Instagram since no web share intent exists', async () => {
    mock.onPost('/admin/products/p1/marketing').reply(200, { success: true, data: content })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    renderWithProviders(<MarketingModal productId="p1" productName="Norwegian Salmon" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Generate Marketing Content' }))
    await screen.findByDisplayValue(content.seoTitle)

    await user.click(screen.getByRole('button', { name: /Instagram/ }))

    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining(content.caption))
    expect(openSpy).toHaveBeenCalledWith('https://www.instagram.com', '_blank')
  })

  it('regenerates content on demand', async () => {
    mock.onPost('/admin/products/p1/marketing').reply(200, { success: true, data: content })
    const user = userEvent.setup()
    renderWithProviders(<MarketingModal productId="p1" productName="Norwegian Salmon" onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Generate Marketing Content' }))
    await screen.findByDisplayValue(content.seoTitle)

    await user.click(screen.getByRole('button', { name: 'Regenerate' }))
    await waitFor(() => expect(mock.history.post).toHaveLength(2))
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<MarketingModal productId="p1" productName="Norwegian Salmon" onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
