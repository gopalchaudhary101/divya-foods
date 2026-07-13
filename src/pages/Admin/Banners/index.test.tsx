import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import AdminBannersPage from './index'
import { adminBannerApi } from '@/services/api/bannerApi'

vi.mock('@/services/api/bannerApi', () => ({
  adminBannerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/services/api/uploadApi', () => ({
  uploadApi: { image: vi.fn() },
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

const banner = {
  id: 'b1', title: 'Fresh Salmon Sale', subtitle: 'This week only',
  image: '/banner-salmon.webp', link: '/products?category=seafood',
  isActive: true, order: 0,
}

beforeEach(() => vi.clearAllMocks())

describe('AdminBannersPage', () => {
  it('shows an empty state with no banners', async () => {
    vi.mocked(adminBannerApi.list).mockResolvedValue([])
    renderWithProviders(<AdminBannersPage />)
    expect(await screen.findByText('No banners yet')).toBeInTheDocument()
  })

  it('lists banners with title, subtitle, and link', async () => {
    vi.mocked(adminBannerApi.list).mockResolvedValue([banner])
    renderWithProviders(<AdminBannersPage />)
    expect(await screen.findByText('Fresh Salmon Sale')).toBeInTheDocument()
    expect(screen.getByText('This week only')).toBeInTheDocument()
    expect(screen.getByText('/products?category=seafood')).toBeInTheDocument()
  })

  it('opens the edit modal pre-filled with banner data', async () => {
    vi.mocked(adminBannerApi.list).mockResolvedValue([banner])
    const user = userEvent.setup()
    renderWithProviders(<AdminBannersPage />)

    await screen.findByText('Fresh Salmon Sale')
    await user.click(screen.getByLabelText('Edit Fresh Salmon Sale'))

    expect(screen.getByText('Edit Banner')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Fresh Salmon Sale')).toBeInTheDocument()
  })

  it('toggles a banner active/inactive', async () => {
    vi.mocked(adminBannerApi.list).mockResolvedValue([banner])
    vi.mocked(adminBannerApi.update).mockResolvedValue({ ...banner, isActive: false })
    const user = userEvent.setup()
    renderWithProviders(<AdminBannersPage />)

    await screen.findByText('Fresh Salmon Sale')
    await user.click(screen.getByLabelText('Deactivate banner'))

    await waitFor(() => expect(adminBannerApi.update).toHaveBeenCalledWith('b1', expect.objectContaining({ isActive: false })))
  })

  it('deletes a banner after confirmation', async () => {
    vi.mocked(adminBannerApi.list).mockResolvedValue([banner])
    vi.mocked(adminBannerApi.delete).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<AdminBannersPage />)

    await screen.findByText('Fresh Salmon Sale')
    await user.click(screen.getByLabelText('Delete Fresh Salmon Sale'))
    expect(screen.getByText('Delete Banner')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(adminBannerApi.delete).toHaveBeenCalledWith('b1'))
  })

  it('creates a new banner with a pasted image URL', async () => {
    vi.mocked(adminBannerApi.list).mockResolvedValue([])
    vi.mocked(adminBannerApi.create).mockResolvedValue({ ...banner, id: 'b2', title: 'New Banner' })
    const user = userEvent.setup()
    renderWithProviders(<AdminBannersPage />)

    await screen.findByText('No banners yet')
    await user.click(screen.getByRole('button', { name: /New Banner/ }))

    await user.click(screen.getByText('Paste image URL instead'))
    await user.type(screen.getByPlaceholderText('https://res.cloudinary.com/...'), 'https://example.com/banner.webp')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await user.type(screen.getByPlaceholderText('Fresh Norwegian Salmon — 20% Off'), 'New Banner')

    const createButtons = screen.getAllByRole('button', { name: 'Create Banner' })
    await user.click(createButtons[createButtons.length - 1])

    await waitFor(() => expect(adminBannerApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Banner', image: 'https://example.com/banner.webp' })
    ))
  })
})
