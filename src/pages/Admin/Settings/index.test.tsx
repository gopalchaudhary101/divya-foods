import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MockAdapter from 'axios-mock-adapter'
import { renderWithProviders } from '@/test/testUtils'
import AdminSettingsPage from './index'
import axiosInstance from '@/services/api/axiosInstance'

const mock = new MockAdapter(axiosInstance)

const settings = {
  businessName: 'Divya Foods', gstNumber: '22AAAAA0000A1Z5', fssaiNumber: '12345678901234',
  maxUploadSizeMB: 5, maxImageDimension: 6000, compressionQuality: 'auto:good' as const,
  allowedFormats: ['jpeg', 'png', 'webp'], enableWebP: true, enableAVIF: true,
  thumbnailSizes: [150, 400, 800],
}

beforeEach(() => {
  mock.reset()
  mock.onGet('/admin/settings').reply(200, { success: true, data: settings })
})
afterAll(() => mock.restore())

describe('AdminSettingsPage', () => {
  it('loads and pre-fills the current settings', async () => {
    renderWithProviders(<AdminSettingsPage />)
    expect(await screen.findByDisplayValue('22AAAAA0000A1Z5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('12345678901234')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Divya Foods')).toBeInTheDocument()
  })

  it('saves updated settings', async () => {
    mock.onPut('/admin/settings').reply(200, {
      success: true, data: { ...settings, gstNumber: '33BBBBB1111B2Z6' },
    })
    const user = userEvent.setup()
    renderWithProviders(<AdminSettingsPage />)

    const gstInput = await screen.findByDisplayValue('22AAAAA0000A1Z5')
    await user.clear(gstInput)
    await user.type(gstInput, '33BBBBB1111B2Z6')
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    const body = JSON.parse(mock.history.put[0].data)
    expect(body.gstNumber).toBe('33BBBBB1111B2Z6')
  })

  it('pre-fills the image upload limits', async () => {
    renderWithProviders(<AdminSettingsPage />)
    expect(await screen.findByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('6000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('150, 400, 800')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'JPEG' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'WEBP' })).toBeChecked()
  })

  it('saves an updated max upload size and toggled AVIF setting', async () => {
    mock.onPut('/admin/settings').reply(200, { success: true, data: { ...settings, maxUploadSizeMB: 10, enableAVIF: false } })
    const user = userEvent.setup()
    renderWithProviders(<AdminSettingsPage />)

    const sizeInput = await screen.findByDisplayValue('5')
    await user.clear(sizeInput)
    await user.type(sizeInput, '10')
    await user.click(screen.getByText('Enable AVIF'))
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() => expect(mock.history.put).toHaveLength(1))
    const body = JSON.parse(mock.history.put[0].data)
    expect(body.maxUploadSizeMB).toBe(10)
    expect(body.enableAVIF).toBe(false)
  })
})
