import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Divya Foods',
        short_name: 'Divya Foods',
        description: 'Premium imported seafood delivered across Delhi NCR — Salmon, Prawns, Tuna, Lobster & more',
        start_url: '/',
        display: 'standalone',
        background_color: '#0B1D2A',
        theme_color: '#0B1D2A',
        orientation: 'portrait-primary',
        categories: ['food', 'shopping'],
        lang: 'en-IN',
        icons: [
          { src: '/icons/icon-192.png',         sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png',         sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/products\/.+\.(webp|png|jpg|jpeg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'product-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/divya-foods-api-production-9380\.up\.railway\.app\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          // Large animation lib — isolate for independent caching
          if (id.includes('framer-motion')) return 'vendor-motion'
          // recharts + D3 deps — only Admin/Analytics uses these (already lazy)
          if (id.includes('recharts') || id.includes('/d3-')) return 'vendor-charts'
          // React DOM + router — most stable, longest cache lifetime
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('@remix-run')
          ) return 'vendor-react'
          // State management
          if (
            id.includes('@reduxjs') ||
            id.includes('react-redux') ||
            id.includes('immer') ||
            id.includes('/redux/')
          ) return 'vendor-state'
          // Data fetching
          if (id.includes('@tanstack')) return 'vendor-query'
          // Form validation
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform') ||
            id.includes('zod')
          ) return 'vendor-forms'
          // Remainder: axios, lucide-react, react-hot-toast, react-helmet-async, etc.
          return 'vendor'
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
