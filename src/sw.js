import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// Injected by vite-plugin-pwa — precache all static assets
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ─── Push notification handler ────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Divya Foods', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Divya Foods', {
      body:    data.body    ?? '',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      data:    { url: data.url ?? '/' },
      vibrate: [200, 100, 200],
      tag:     data.tag    ?? 'divya-foods',
      renotify: true,
    })
  )
})

// ─── Notification click — open/focus the relevant page ────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url === url)
        if (existing) return existing.focus()
        return self.clients.openWindow(url)
      })
  )
})
