import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { screen } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AboutPage from './index'
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

describe('AboutPage', () => {
  it('renders the page heading', () => {
    renderWithProviders(<AboutPage />)
    expect(screen.getByRole('heading', { name: /About/, level: 1 })).toBeInTheDocument()
  })

  it('shows GST and FSSAI numbers once loaded', async () => {
    renderWithProviders(<AboutPage />)
    expect(await screen.findByText('22AAAAA0000A1Z5')).toBeInTheDocument()
    expect(screen.getByText('12345678901234')).toBeInTheDocument()
  })
})
