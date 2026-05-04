import { Workbox } from 'workbox-window'

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null
let updateCheckBound = false
let updateCheckInFlight = false

function bindUpdateChecks(): void {
  if (updateCheckBound || typeof document === 'undefined') {
    return
  }
  updateCheckBound = true

  const checkForUpdates = () => {
    if (updateCheckInFlight) {
      return
    }
    updateCheckInFlight = true
    void getPwaRegistration()
      .then((registration) => registration?.update())
      .finally(() => {
        updateCheckInFlight = false
      })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdates()
    }
  })

  window.addEventListener('focus', checkForUpdates)
}

export function registerPwa(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return
  }

  bindUpdateChecks()

  window.addEventListener('load', () => {
    const wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`)
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
