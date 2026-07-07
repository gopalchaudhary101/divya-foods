import { type PropsWithChildren, type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'

import authReducer from '@/features/auth/authSlice'
import cartReducer from '@/features/cart/cartSlice'
import wishlistReducer from '@/features/wishlist/wishlistSlice'
import uiReducer from '@/store/slices/uiSlice'
import type { RootState } from '@/store'

export type PartialRootState = { [K in keyof RootState]?: RootState[K] }

export function createTestStore(preloadedState?: PartialRootState) {
  return configureStore({
    reducer: {
      auth: authReducer,
      cart: cartReducer,
      wishlist: wishlistReducer,
      ui: uiReducer,
    },
    // Tests only ever pass a subset of slices; Redux merges partial preloaded
    // state with each reducer's own initial state at runtime.
    preloadedState: preloadedState as RootState | undefined,
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
  preloadedState?: PartialRootState
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

export function createHookWrapper(preloadedState?: PartialRootState) {
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
