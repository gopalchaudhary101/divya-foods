import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import Footer from './Footer'
import { CONFIG } from '@/constants/config'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

beforeEach(() => {
  mock.reset()
  mock.onGet('/settings').reply(200, {
    success: true,
    data: { businessName: 'Divya Foods', gstNumber: '22AAAAA0000A1Z5', fssaiNumber: '12345678901234' },
  })
})
afterAll(() => mock.restore())

describe('Footer', () => {
  it('renders the brand name and tagline', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByText(CONFIG.APP_NAME)).toBeInTheDocument()
    expect(screen.getByText(CONFIG.TAGLINE)).toBeInTheDocument()
  })

  it('renders contact links with correct hrefs', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByText(CONFIG.CONTACT.EMAIL).closest('a')).toHaveAttribute(
      'href', `mailto:${CONFIG.CONTACT.EMAIL}`
    )
    expect(screen.getByText(CONFIG.CONTACT.PHONE_1).closest('a')).toHaveAttribute(
      'href', `tel:${CONFIG.CONTACT.PHONE_1.replace(/\s/g, '')}`
    )
  })

  it('lists all configured delivery areas', () => {
    renderWithProviders(<Footer />)
    CONFIG.DELIVERY.AREAS.forEach((area) => {
      expect(screen.getByText(area)).toBeInTheDocument()
    })
  })

  it('shows the current year in the copyright line', () => {
    renderWithProviders(<Footer />)
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()}`))).toBeInTheDocument()
  })

  it('shows GST and FSSAI numbers once settings load', async () => {
    renderWithProviders(<Footer />)
    await waitFor(() => {
      expect(screen.getByText(/22AAAAA0000A1Z5/)).toBeInTheDocument()
      expect(screen.getByText(/12345678901234/)).toBeInTheDocument()
    })
  })
})
