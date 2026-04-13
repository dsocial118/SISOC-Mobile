import { Workbox } from 'workbox-window'

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

export function registerPwa(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return
  }

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    const wb = new Workbox(swUrl)
    registrationPromise = wb.register().then((registration) => registration ?? null)
  })
}

export function getPwaRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (registrationPromise) {
    return registrationPromise
  }
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.ready.catch(() => null)
  }
  return Promise.resolve(null)
}
