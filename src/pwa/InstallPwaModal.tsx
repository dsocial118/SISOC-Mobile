import { useEffect, useMemo, useState } from 'react'
import { InstallNoticeCard } from './InstallNoticeCard'
import { SmallWhiteButton } from '../ui/buttons'

const DISMISS_KEY = 'sisoc-install-modal-dismissed-session'

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = 'standalone' in window.navigator && window.navigator.standalone === true
  return standaloneMedia || iosStandalone
}

export function InstallPwaModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode())

  const platform = useMemo(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    const isIos = /iphone|ipad|ipod/.test(userAgent)
    const isAndroid = /android/.test(userAgent)
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent)

    if (isIos) {
      return isSafari ? 'ios-safari' : 'ios-other'
    }
    if (isAndroid) {
      return 'android'
    }
    return 'other'
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsStandalone(event.matches)
    }
    const handleAppInstalled = () => setIsStandalone(true)

    mediaQuery.addEventListener('change', handleMediaChange)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    if (isStandalone) {
      return
    }

    const dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'
    if (!dismissed) {
      const timer = window.setTimeout(() => setIsOpen(true), 400)
      return () => window.clearTimeout(timer)
    }
  }, [isStandalone])

  if (isStandalone || !isOpen) {
    return null
  }

  const installText =
    platform === 'ios-other'
      ? 'En iPhone, abri esta pagina en Safari y elegi Agregar a pantalla de inicio.'
      : platform === 'ios-safari'
        ? 'Abri Compartir y elegi Agregar a pantalla de inicio.'
        : platform === 'android'
          ? 'Abri el menu del navegador y elegi Instalar aplicacion.'
          : 'Usa un navegador compatible y elegi Instalar aplicacion o Agregar a pantalla de inicio.'

  function handleClose() {
    setIsOpen(false)
    sessionStorage.setItem(DISMISS_KEY, '1')
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <InstallNoticeCard
        title="Instalar app SiSOC Mobil"
        primaryAction={
          <SmallWhiteButton
            onClick={handleClose}
            className="m-0 h-[42px] min-w-[124px] px-5 text-[15px] leading-none"
          >
            Entendido
          </SmallWhiteButton>
        }
      >
        <p>{installText}</p>
      </InstallNoticeCard>
    </div>
  )
}
