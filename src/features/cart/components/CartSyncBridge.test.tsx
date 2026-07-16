import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { CartSyncBridge } from './CartSyncBridge'
import { cartApi } from '@/services/api/cartApi'
import { createTestStore, createTestQueryClient, type PartialRootState } from '@/test/testUtils'

vi.mock('@/services/api/cartApi', () => ({
  cartApi: { syncCart: vi.fn() },
}))

const item = { productId: 'p1', name: 'Salmon', price: 999, quantity: 1, image: '', maxQuantity: 5 }

function renderBridge(preloadedState: PartialRootState) {
  const store = createTestStore(preloadedState)
  const queryClient = createTestQueryClient()
  render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <CartSyncBridge />
      </QueryClientProvider>
    </Provider>
  )
  return store
}

beforeEach(() => vi.clearAllMocks())

describe('CartSyncBridge', () => {
  it('does not sync when the user is unauthenticated', async () => {
    renderBridge({
      auth: { user: null, token: null, isAuthenticated: false, isLoading: false },
      cart: { items: [item], totalItems: 1, totalPrice: 999 },
    })
    await new Promise((resolve) => setTimeout(resolve, 1700))
    expect(cartApi.syncCart).not.toHaveBeenCalled()
  })

  it('syncs the current cart to the server once the user is authenticated', async () => {
    vi.mocked(cartApi.syncCart).mockResolvedValue(undefined)
    renderBridge({
      auth: {
        user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', createdAt: '' },
        token: 't', isAuthenticated: true, isLoading: false,
      },
      cart: { items: [item], totalItems: 1, totalPrice: 999 },
    })
    await waitFor(() => expect(cartApi.syncCart).toHaveBeenCalled(), { timeout: 3000 })
    expect(vi.mocked(cartApi.syncCart).mock.calls[0][0]).toEqual([item])
  })

  it('does not re-sync when the debounced item set has not changed', async () => {
    vi.mocked(cartApi.syncCart).mockResolvedValue(undefined)
    renderBridge({
      auth: {
        user: { id: 'u1', name: 'A', email: 'a@test.com', role: 'customer', createdAt: '' },
        token: 't', isAuthenticated: true, isLoading: false,
      },
      cart: { items: [item], totalItems: 1, totalPrice: 999 },
    })
    await waitFor(() => expect(cartApi.syncCart).toHaveBeenCalledTimes(1), { timeout: 3000 })
    await new Promise((resolve) => setTimeout(resolve, 1700))
    expect(cartApi.syncCart).toHaveBeenCalledTimes(1)
  })
})
