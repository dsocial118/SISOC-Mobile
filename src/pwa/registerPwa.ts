import { Workbox } from 'workbox-window'

export function registerPwa(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return
  }

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`
    const wb = new Workbox(swUrl)
    void wb.register()
  })
}
