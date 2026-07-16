import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { cartApi } from '@/services/api/cartApi'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useDebounce } from '@/hooks/useDebounce'

/**
 * Silently mirrors the Redux cart to the server cart whenever it changes
 * while the user is logged in. Renders nothing and never surfaces errors —
 * Redux stays the single source of truth for the UI (checkout, item counts,
 * etc. are all unaffected by this).
 *
 * Without this, nothing ever wrote to the `carts` collection, so the
 * abandoned-cart reminder job (backend/app/services/cart_service.py) ran
 * every 30 minutes and always found zero candidates.
 */
export function CartSyncBridge() {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated)
  const items = useAppSelector((s) => s.cart.items)
  const debouncedItems = useDebounce(items, 1500)
  const { mutate } = useMutation({ mutationFn: cartApi.syncCart })
  const lastSyncedKey = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      lastSyncedKey.current = null
      return
    }
    const key = JSON.stringify(debouncedItems)
    if (key === lastSyncedKey.current) return
    lastSyncedKey.current = key
    mutate(debouncedItems)
  }, [isAuthenticated, debouncedItems, mutate])

  return null
}
