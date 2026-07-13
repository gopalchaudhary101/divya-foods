import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/testUtils'
import CheckoutPage from './index'
import { orderApi } from '@/services/api/orderApi'
import { couponApi } from '@/services/api/couponApi'
import { ROUTES } from '@/constants/routes'
import type { CartItem } from '@/types'

vi.mock('@/services/api/orderApi', () => ({
  orderApi: { initiate: vi.fn(), verifyPayment: vi.fn(), initiateGuest: vi.fn(), verifyGuestPayment: vi.fn(), trackGuestOrder: vi.fn() },
}))
vi.mock('@/services/api/couponApi', () => ({
  couponApi: { validate: vi.fn() },
}))
vi.mock('@/services/api/settingsApi', () => ({
  settingsApi: { get: vi.fn().mockResolvedValue({ businessName: 'Divya Foods', gstNumber: 'GST123', fssaiNumber: 'FSSAI456' }) },
}))
vi.mock('@/services/api/whatsappApi', () => ({
  whatsappApi: { getConfig: vi.fn().mockResolvedValue({
    enabled: false, phoneNumber: '', productMessageTemplate: '', cartMessageTemplate: '', orderMessageTemplate: '',
  }), trackShare: vi.fn().mockResolvedValue(undefined) },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const item: CartItem = {
  productId: 'p1', name: 'Salmon', price: 1500, quantity: 1, image: '/salmon.webp', maxQuantity: 5,
}

const authedCartState = {
  auth: {
    user: { id: 'u1', name: 'Priya', email: 'p@test.com', phone: '9999999999', role: 'customer' as const, createdAt: '' },
    token: 'tok', isAuthenticated: true, isLoading: false,
  },
  cart: { items: [item], totalItems: 1, totalPrice: 1500 },
}

async function fillAddressAndContinue(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('House No., Street, Colony'), '123 Test Street')
  await user.type(screen.getByPlaceholderText('110044'), '110044')
  await user.click(screen.getByRole('button', { name: 'Continue to Review' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockClear()
})

describe('CheckoutPage — guards', () => {
  it('shows a login/guest choice for unauthenticated users instead of redirecting immediately', () => {
    renderWithProviders(<CheckoutPage />, {
      preloadedState: { cart: { items: [item], totalItems: 1, totalPrice: 1500 } },
    })
    expect(screen.getByText('How would you like to check out?')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to login when "Log In" is chosen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, {
      preloadedState: { cart: { items: [item], totalItems: 1, totalPrice: 1500 } },
    })
    await user.click(screen.getByRole('button', { name: /Log In/ }))
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.AUTH.LOGIN, { state: { from: ROUTES.CHECKOUT } })
  })

  it('shows the guest email field on the address form when "Continue as Guest" is chosen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, {
      preloadedState: { cart: { items: [item], totalItems: 1, totalPrice: 1500 } },
    })
    await user.click(screen.getByRole('button', { name: /Continue as Guest/ }))
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  })

  it('redirects to cart when cart is empty', () => {
    renderWithProviders(<CheckoutPage />, {
      preloadedState: {
        auth: { user: null, token: 'tok', isAuthenticated: true, isLoading: false },
        cart: { items: [], totalItems: 0, totalPrice: 0 },
      },
    })
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.CART)
  })
})

describe('CheckoutPage — delivery slot', () => {
  it('defaults to express delivery and reveals date/window pickers when scheduling', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    expect(screen.getByText('Fastest dispatch (24–48 hrs)')).toBeInTheDocument()
    expect(screen.queryByText('Time Window')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Schedule for Later/ }))
    expect(screen.getByText('Time Window')).toBeInTheDocument()
  })

  it('sends the chosen delivery slot when initiating an order', async () => {
    vi.mocked(orderApi.initiate).mockResolvedValue({
      orderId: 'o1', orderNumber: 'DF-001', razorpayOrderId: 'rzp_1',
      razorpayKeyId: 'rzp_key', amount: 1600, currency: 'INR',
    })
    window.Razorpay = vi.fn().mockImplementation(function RazorpayCtor() { return { open: vi.fn() } }) as unknown as typeof window.Razorpay

    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await user.click(screen.getByRole('button', { name: /Schedule for Later/ }))
    await fillAddressAndContinue(user)
    await user.click(screen.getByRole('button', { name: 'Proceed to Pay' }))
    await user.click(screen.getByRole('button', { name: /Pay ₹/ }))

    await waitFor(() => expect(orderApi.initiate).toHaveBeenCalled())
    const deliverySlotArg = vi.mocked(orderApi.initiate).mock.calls[0][4]
    expect(deliverySlotArg).toMatchObject({ type: 'scheduled', timeWindow: '8am - 12pm' })
  })
})

describe('CheckoutPage — gift card', () => {
  function mockRazorpay() {
    const open = vi.fn()
    const RazorpayMock = vi.fn().mockImplementation(function RazorpayCtor() { return { open } })
    window.Razorpay = RazorpayMock as unknown as typeof window.Razorpay
    return { RazorpayMock, open }
  }

  it('sends the entered gift card code when initiating an order', async () => {
    mockRazorpay()
    vi.mocked(orderApi.initiate).mockResolvedValue({
      orderId: 'o1', orderNumber: 'DF-001', razorpayOrderId: 'rzp_1',
      razorpayKeyId: 'rzp_key', amount: 1000, currency: 'INR',
    })
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)
    await user.type(screen.getByPlaceholderText('GIFT CARD CODE (optional)'), 'gift-abc123')
    await user.click(screen.getByRole('button', { name: 'Proceed to Pay' }))
    await user.click(screen.getByRole('button', { name: /Pay ₹/ }))

    await waitFor(() => expect(orderApi.initiate).toHaveBeenCalled())
    const giftCardArg = vi.mocked(orderApi.initiate).mock.calls[0][5]
    expect(giftCardArg).toBe('GIFT-ABC123')
  })

  it('skips the Razorpay popup and navigates straight to the order when a gift card fully covers the total', async () => {
    const { open } = mockRazorpay()
    vi.mocked(orderApi.initiate).mockResolvedValue({
      orderId: 'o1', orderNumber: 'DF-001', razorpayOrderId: null as unknown as string,
      razorpayKeyId: 'rzp_key', amount: 0, currency: 'INR',
    })
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)
    await user.type(screen.getByPlaceholderText('GIFT CARD CODE (optional)'), 'FULLCOVER')
    await user.click(screen.getByRole('button', { name: 'Proceed to Pay' }))
    await user.click(screen.getByRole('button', { name: /Pay ₹/ }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/orders/o1', { state: { justOrdered: true } }))
    expect(open).not.toHaveBeenCalled()
  })
})

describe('CheckoutPage — address step', () => {
  it('pre-fills name and phone from the logged-in user', () => {
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })
    expect(screen.getByPlaceholderText('Raj Kumar')).toHaveValue('Priya')
    expect(screen.getByPlaceholderText('+91 9999123456')).toHaveValue('9999999999')
  })

  it('shows GST and FSSAI numbers in the order summary sidebar', async () => {
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })
    expect(await screen.findByText(/GST123/)).toBeInTheDocument()
    expect(screen.getByText(/FSSAI456/)).toBeInTheDocument()
  })

  it('requires address line 1 and a valid pincode before continuing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
  })

  it('rejects an invalid pincode', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await user.type(screen.getByPlaceholderText('House No., Street, Colony'), '123 Test Street')
    await user.type(screen.getByPlaceholderText('110044'), '123')
    await user.click(screen.getByRole('button', { name: 'Continue to Review' }))

    expect(screen.getByText('6-digit pincode required')).toBeInTheDocument()
  })

  it('advances to the review step once the address is valid', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)

    expect(screen.getByText('Review Your Order')).toBeInTheDocument()
    expect(screen.getByText('Salmon')).toBeInTheDocument()
  })
})

describe('CheckoutPage — review step / coupon', () => {
  it('applies a valid coupon and shows the discount', async () => {
    vi.mocked(couponApi.validate).mockResolvedValue({ valid: true, discountAmount: 150, message: '10% off applied!' })
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)
    await user.type(screen.getByPlaceholderText('COUPON CODE'), 'SAVE10')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(await screen.findByText('10% off applied!')).toBeInTheDocument()
    expect(screen.getByText('Applied')).toBeInTheDocument()
  })

  it('shows an error message for an invalid coupon without applying a discount', async () => {
    vi.mocked(couponApi.validate).mockResolvedValue({ valid: false, discountAmount: 0, message: 'Invalid coupon code.' })
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)
    await user.type(screen.getByPlaceholderText('COUPON CODE'), 'BADCODE')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(await screen.findByText('Invalid coupon code.')).toBeInTheDocument()
    expect(screen.queryByText('Applied')).not.toBeInTheDocument()
  })

  it('proceeds to the payment step', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)
    await user.click(screen.getByRole('button', { name: 'Proceed to Pay' }))

    expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument()
    expect(screen.getByText('Razorpay Secure Payment')).toBeInTheDocument()
  })
})

describe('CheckoutPage — payment step', () => {
  function mockRazorpay() {
    const open = vi.fn()
    // Must be a real `function`, not an arrow function — the app calls `new window.Razorpay(...)`,
    // and arrow functions cannot be used as constructors.
    const RazorpayMock = vi.fn().mockImplementation(function RazorpayCtor() { return { open } })
    window.Razorpay = RazorpayMock as unknown as typeof window.Razorpay
    return { RazorpayMock, open }
  }

  it('initiates the order and opens the Razorpay popup on Pay click', async () => {
    const { RazorpayMock, open } = mockRazorpay()
    vi.mocked(orderApi.initiate).mockResolvedValue({
      orderId: 'o1', orderNumber: 'DF-001', razorpayOrderId: 'rzp_1',
      razorpayKeyId: 'rzp_key', amount: 1600, currency: 'INR',
    })
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)
    await user.click(screen.getByRole('button', { name: 'Proceed to Pay' }))
    await user.click(screen.getByRole('button', { name: /Pay ₹/ }))

    await waitFor(() => expect(open).toHaveBeenCalled())
    expect(orderApi.initiate).toHaveBeenCalled()
    expect(RazorpayMock).toHaveBeenCalledWith(expect.objectContaining({ order_id: 'rzp_1' }))
  })

  it('shows an error if order initiation fails', async () => {
    mockRazorpay()
    vi.mocked(orderApi.initiate).mockRejectedValue(new Error('Server error, please retry.'))
    const user = userEvent.setup()
    renderWithProviders(<CheckoutPage />, { preloadedState: authedCartState })

    await fillAddressAndContinue(user)
    await user.click(screen.getByRole('button', { name: 'Proceed to Pay' }))
    await user.click(screen.getByRole('button', { name: /Pay ₹/ }))

    expect(await screen.findByText('Server error, please retry.')).toBeInTheDocument()
  })
})
