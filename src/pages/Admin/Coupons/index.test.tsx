import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import AdminCouponsPage from './index'
import { adminCouponApi } from '@/services/api/couponApi'

vi.mock('@/services/api/couponApi', () => ({
  adminCouponApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const coupon = {
  id: 'c1', code: 'SAVE10', discountType: 'percentage' as const, discountValue: 10,
  minOrderValue: 0, maxDiscount: null, isActive: true, expiresAt: null,
  usageLimit: null, usedCount: 0, createdAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => vi.clearAllMocks())

describe('AdminCouponsPage', () => {
  it('shows an empty state with no coupons', async () => {
    vi.mocked(adminCouponApi.list).mockResolvedValue([])
    renderWithProviders(<AdminCouponsPage />)
    expect(await screen.findByText('No coupons yet')).toBeInTheDocument()
  })

  it('lists coupons with discount and usage info', async () => {
    vi.mocked(adminCouponApi.list).mockResolvedValue([coupon])
    renderWithProviders(<AdminCouponsPage />)
    expect(await screen.findByText('SAVE10')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('creates a new coupon', async () => {
    vi.mocked(adminCouponApi.list).mockResolvedValue([])
    vi.mocked(adminCouponApi.create).mockResolvedValue({ ...coupon, id: 'c2', code: 'WELCOME20' })
    const user = userEvent.setup()
    renderWithProviders(<AdminCouponsPage />)

    await screen.findByText('No coupons yet')
    await user.click(screen.getByRole('button', { name: /New Coupon/ }))
    await user.type(screen.getByPlaceholderText('DIVYA20'), 'welcome20')
    const discountInput = screen.getByPlaceholderText('20')
    await user.clear(discountInput)
    await user.type(discountInput, '20')
    const createButtons = screen.getAllByRole('button', { name: 'Create Coupon' })
    await user.click(createButtons[createButtons.length - 1])

    await waitFor(() => expect(adminCouponApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WELCOME20', discountValue: 20 })
    ))
  })

  it('toggles a coupon active/inactive', async () => {
    vi.mocked(adminCouponApi.list).mockResolvedValue([coupon])
    vi.mocked(adminCouponApi.update).mockResolvedValue({ ...coupon, isActive: false })
    const user = userEvent.setup()
    renderWithProviders(<AdminCouponsPage />)

    await screen.findByText('SAVE10')
    await user.click(screen.getByLabelText('Deactivate coupon'))

    await waitFor(() => expect(adminCouponApi.update).toHaveBeenCalledWith('c1', expect.objectContaining({ isActive: false })))
  })

  it('opens the edit modal pre-filled with coupon data', async () => {
    vi.mocked(adminCouponApi.list).mockResolvedValue([coupon])
    const user = userEvent.setup()
    renderWithProviders(<AdminCouponsPage />)

    await screen.findByText('SAVE10')
    await user.click(screen.getByLabelText('Edit SAVE10'))

    expect(screen.getByText('Edit Coupon')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('DIVYA20')).toHaveValue('SAVE10')
  })

  it('deletes a coupon after confirmation', async () => {
    vi.mocked(adminCouponApi.list).mockResolvedValue([coupon])
    vi.mocked(adminCouponApi.delete).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<AdminCouponsPage />)

    await screen.findByText('SAVE10')
    await user.click(screen.getByLabelText('Delete SAVE10'))
    expect(screen.getByText('Delete Coupon')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(adminCouponApi.delete).toHaveBeenCalledWith('c1'))
  })

  it('flags an expired coupon', async () => {
    vi.mocked(adminCouponApi.list).mockResolvedValue([{
      ...coupon, expiresAt: '2020-01-01T00:00:00Z',
    }])
    renderWithProviders(<AdminCouponsPage />)
    expect(await screen.findByText(/\(expired\)/)).toBeInTheDocument()
  })
})
