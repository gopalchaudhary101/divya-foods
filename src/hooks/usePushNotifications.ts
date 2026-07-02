import { useState, useEffect, useCallback } from 'react'
import axiosInstance from '@/services/api/axiosInstance'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading'

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading')

  // Detect initial state on mount
  useEffect(() => {
    async function init() {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      setStatus(existing ? 'subscribed' : 'unsubscribed')
    }
    init()
  }, [])

  const subscribe = useCallback(async () => {
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed')
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      await axiosInstance.post('/notifications/subscribe', subscription.toJSON())
      setStatus('subscribed')
      return true
    } catch {
      setStatus('unsubscribed')
      return false
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setStatus('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await axiosInstance.delete('/notifications/subscribe', {
          data: { endpoint: sub.endpoint },
        })
      }
      setStatus('unsubscribed')
      return true
    } catch {
      setStatus('subscribed')
      return false
    }
  }, [])

  return { status, subscribe, unsubscribe }
}
