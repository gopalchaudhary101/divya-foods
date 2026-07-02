import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'df-install-dismissed'

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already dismissed or already installed
    if (localStorage.getItem(DISMISSED_KEY) === '1') return
    if (window.matchMedia('(display-mode: standalone)').matches) return

    function handler(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      // Show after 6 seconds so it doesn't interrupt first impression
      setTimeout(() => setVisible(true), 6000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
      setPromptEvent(null)
    }
  }

  function handleDismiss() {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  return (
    <AnimatePresence>
      {visible && promptEvent && (
        <motion.div
          key="install-prompt"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50"
        >
          <div className="bg-ocean-900 border border-ocean-700 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-ocean-700 rounded-xl flex items-center justify-center shrink-0">
                <Download size={18} className="text-gold-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Add to Home Screen</p>
                <p className="text-xs text-ocean-300 mt-0.5 leading-relaxed">
                  Install Divya Foods for faster access and offline browsing
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleInstall}
                    className="px-4 py-1.5 bg-gold-500 hover:bg-gold-400 text-ocean-900 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Install
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 text-ocean-400 hover:text-ocean-200 text-xs transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="p-1 text-ocean-500 hover:text-white transition-colors shrink-0"
                aria-label="Dismiss install prompt"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
