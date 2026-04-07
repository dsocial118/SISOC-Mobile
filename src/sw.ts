/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>
}

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ request, url }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-get-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  }),
)

self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = event.data.json() as Record<string, unknown>
  } catch {
    payload = {
      title: 'SISOC',
      body: event.data.text(),
    }
  }

  const title = String(payload.title || 'SISOC')
  const options: NotificationOptions = {
    body: String(payload.body || ''),
    icon: String(payload.icon || '/icono.png'),
    badge: String(payload.badge || '/icono.png'),
    tag: String(payload.tag || ''),
    data: payload.data || {},
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl =
    typeof event.notification.data?.url === 'string'
      ? event.notification.data.url
      : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const absoluteUrl = new URL(targetUrl, self.location.origin).href
      for (const client of clients) {
        if ('focus' in client) {
          void client.navigate(absoluteUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow(absoluteUrl)
    }),
  )
})
