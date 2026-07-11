import { useEffect } from 'react'
import { playEntrySplash } from '@/utils/entrySound'

const SESSION_KEY = 'df_entry_sound_played'

/**
 * Plays a short splash sound the first time a visitor interacts with the
 * site (click/tap/keypress) — browsers block audio before any user
 * interaction, so there's no way to play something on load itself. Fires at
 * most once per browser session (sessionStorage), not once per page/route.
 */
export function useEntrySound(): void {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return

    function handleFirstInteraction() {
      playEntrySplash()
      sessionStorage.setItem(SESSION_KEY, '1')
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true })
    window.addEventListener('keydown', handleFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [])
}
