import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time exceptions anywhere below it so one broken component
 * shows a recoverable screen instead of unmounting the entire app to blank
 * white (React 18's default behavior on an uncaught render error).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error caught by ErrorBoundary:', error, info.componentStack)
    // Safe to call even when Sentry.init() was never run (no DSN configured) —
    // the SDK's top-level calls are no-ops without an active client.
    Sentry.captureException(error)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-premium-cream dark:bg-[#03182E] px-4">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-4">🐟</p>
          <h1 className="text-2xl font-display font-semibold text-premium-navy dark:text-ocean-50">
            Something went wrong
          </h1>
          <p className="text-premium-navy/60 dark:text-ocean-50/60 mt-3">
            We hit a snag loading this page. Try reloading — if it keeps happening, our team has already been notified.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={this.handleReload}
              className="px-8 py-3 bg-premium-gold text-premium-navy font-semibold rounded-full hover:bg-premium-gold-light transition-colors"
            >
              Reload page
            </button>
            <a
              href="/"
              className="px-8 py-3 border border-premium-navy/20 dark:border-ocean-50/20 text-premium-navy dark:text-ocean-50 font-semibold rounded-full hover:bg-premium-navy/5 dark:hover:bg-ocean-50/5 transition-colors"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
