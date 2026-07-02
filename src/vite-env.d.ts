/// <reference types="vite/client" />

/**
 * Extends Vite's built-in ImportMetaEnv with our project's env variables.
 * Every VITE_* variable in .env.example must be declared here.
 * This gives TypeScript full type safety on import.meta.env.VITE_*
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production'
  readonly VITE_RAZORPAY_KEY_ID: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
