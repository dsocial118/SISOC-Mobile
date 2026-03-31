import { Workbox } from 'workbox-window'

export function registerPwa(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return
  }

  window.addEventListener('load', () => {
    const wb = new Workbox('/sw.js')
    void wb.register()
  })
}
