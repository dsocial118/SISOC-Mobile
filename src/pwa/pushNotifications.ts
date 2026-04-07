import { getPushConfig, savePushSubscription, type PushSubscriptionPayload } from '../api/pushApi'
import { getPwaRegistration } from './registerPwa'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

function serializeSubscription(subscription: PushSubscription): PushSubscriptionPayload | null {
  const rawKeys = subscription.toJSON().keys
  if (!rawKeys?.p256dh || !rawKeys.auth) {
    return null
  }

  return {
    endpoint: subscription.endpoint,
    p256dh: rawKeys.p256dh,
    auth: rawKeys.auth,
    content_encoding: 'aes128gcm',
  }
}

export async function syncPushSubscriptionForCurrentUser(): Promise<void> {
  if (
    typeof window === 'undefined'
    || !('Notification' in window)
    || !('serviceWorker' in navigator)
    || !('PushManager' in window)
    || !navigator.onLine
  ) {
    return
  }

  const config = await getPushConfig()
  if (!config.enabled || !config.public_key) {
    return
  }

  const registration = await getPwaRegistration()
  if (!registration) {
    return
  }

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') {
    return
  }

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.public_key) as BufferSource,
    })
  }

  const payload = serializeSubscription(subscription)
  if (!payload) {
    return
  }
  await savePushSubscription(payload)
}
