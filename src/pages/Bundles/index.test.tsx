import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import BundlesPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)
beforeEach(() => mock.reset())

const bundle = {
  id: 'b1', name: 'Seafood Combo', description: 'Great value', image: null,
  bundlePrice: 999, isActive: true, items: [], createdAt: '',
}

describe('BundlesPage', () => {
  it('shows an empty state when there are no bundles', async () => {
    mock.onGet('/bundles').reply(200, { success: true, data: [] })
    renderWithProviders(<BundlesPage />)
    expect(await screen.findByText('No bundles yet')).toBeInTheDocument()
  })

  it('renders bundle cards once loaded', async () => {
    mock.onGet('/bundles').reply(200, { success: true, data: [bundle] })
    renderWithProviders(<BundlesPage />)
    expect(await screen.findByText('Seafood Combo')).toBeInTheDocument()
  })
})
