/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>
}

const appScopeUrl = new URL(self.registration.scope)
const resolveAppUrl = (value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return value
  }
  const url = new URL(value, appScopeUrl)
  if (value.startsWith('/') && !url.pathname.startsWith(appScopeUrl.pathname)) {
    return new URL(value.replace(/^\//, ''), appScopeUrl).href
  }
  return url.href
}

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ request, url }) => request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-get-cache',
    networkTimeoutSeconds: 6,
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
      title: 'SiSOC Mobil',
      body: event.data.text(),
    }
  }

  const title = String(payload.title || 'SiSOC Mobil')
  const options: NotificationOptions = {
    body: String(payload.body || ''),
    icon: String(payload.icon || resolveAppUrl('sisoc_ico_512.png')),
    badge: String(payload.badge || resolveAppUrl('sisoc_ico_192.png')),
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
      : self.registration.scope

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const absoluteUrl = resolveAppUrl(targetUrl)
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
