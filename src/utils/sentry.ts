import * as Sentry from '@sentry/react'

/**
 * Initializes error tracking — a no-op if VITE_SENTRY_DSN isn't set, so local
 * dev and any environment without a DSN configured behaves exactly as before.
 * Call once, as early as possible (see main.tsx).
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV || 'production',
    tracesSampleRate: 0.1,
  })
}
