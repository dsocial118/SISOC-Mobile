import { Workbox } from 'workbox-window'

export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    const wb = new Workbox('/sw.js')
    void wb.register()
  })
}
