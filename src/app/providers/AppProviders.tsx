import React from 'react'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import { store } from '@/store'
import { AuthInitializer } from '@/features/auth/components/AuthInitializer'
import { CartSyncBridge } from '@/features/cart/components/CartSyncBridge'
import { InstallPrompt } from '@/components/shared/InstallPrompt'
import { FreeChatbot } from '@/components/shared/FreeChatbot'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // cache data for 5 minutes before refetching
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <HelmetProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <AuthInitializer>
            {children}
          </AuthInitializer>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#0B1D2A',
                color: '#F5F1E8',
                fontFamily: 'Inter, sans-serif',
                borderRadius: '8px',
              },
              success: { iconTheme: { primary: '#2E8B8B', secondary: '#0B1D2A' } },
              error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
            }}
          />
          <CartSyncBridge />
          <InstallPrompt />
          <FreeChatbot />
        </QueryClientProvider>

      </Provider>
    </HelmetProvider>
  )
}
