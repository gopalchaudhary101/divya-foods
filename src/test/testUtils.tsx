import { type PropsWithChildren, type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { configureStore, type PreloadedState } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'

import authReducer from '@/features/auth/authSlice'
import cartReducer from '@/features/cart/cartSlice'
import wishlistReducer from '@/features/wishlist/wishlistSlice'
import uiReducer from '@/store/slices/uiSlice'
import type { RootState } from '@/store'

export function createTestStore(preloadedState?: PreloadedState<RootState>) {
  return configureStore({
    reducer: {
      auth: authReducer,
      cart: cartReducer,
      wishlist: wishlistReducer,
      ui: uiReducer,
    },
    preloadedState,
  })
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface ExtraRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: PreloadedState<RootState>
  route?: string
}

export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, route = '/', ...renderOptions }: ExtraRenderOptions = {}
) {
  const store = createTestStore(preloadedState)
  const queryClient = createTestQueryClient()

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <HelmetProvider>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </QueryClientProvider>
        </Provider>
      </HelmetProvider>
    )
  }

  return { store, queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}

export function createHookWrapper(preloadedState?: PreloadedState<RootState>) {
  const store = createTestStore(preloadedState)
  const queryClient = createTestQueryClient()

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }

  return { store, queryClient, Wrapper }
}

export * from '@testing-library/react'
