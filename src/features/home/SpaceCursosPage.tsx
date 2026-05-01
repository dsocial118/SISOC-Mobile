import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { appButtonClass } from '../../ui/buttons'
import { useAppTheme } from '../../ui/ThemeContext'

const CURSOS_URL = 'https://formandocapitalhumano.secretarianaf.gob.ar/'

export function SpaceCursosPage() {
  const { isDark } = useAppTheme()
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [forceExternal, setForceExternal] = useState(false)
  const fallbackTriggeredRef = useRef(false)

  const detailClass = isDark ? 'text-white/80' : 'text-slate-600'
  const cardStyle = isDark
    ? {
        backgroundColor: '#232D4F',
        borderColor: '#E0E0E0',
        boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.25)',
      }
    : {
        backgroundColor: '#F5F5F5',
        borderColor: '#E0E0E0',
        boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.25)',
      }

  useEffect(() => {
    if (iframeLoaded || forceExternal || fallbackTriggeredRef.current) {
      return
    }
    const timeoutId = window.setTimeout(() => {
      if (fallbackTriggeredRef.current || iframeLoaded) {
        return
      }
      fallbackTriggeredRef.current = true
      setForceExternal(true)
      const openedWindow = window.open(CURSOS_URL, '_blank', 'noopener,noreferrer')
      if (!openedWindow) {
        window.location.href = CURSOS_URL
      }
    }, 4500)
    return () => window.clearTimeout(timeoutId)
  }, [forceExternal, iframeLoaded])

  return (
    <section className="grid gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          className={appButtonClass({ variant: 'outline-secondary', size: 'sm' })}
          onClick={() => window.open(CURSOS_URL, '_blank', 'noopener,noreferrer')}
        >
          <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
          Abrir en navegador
        </button>
      </div>

      {!forceExternal ? (
        <article className="overflow-hidden rounded-[15px] border" style={cardStyle}>
          <iframe
            title="Cursos Formando Capital Humano"
            src={CURSOS_URL}
            className="h-[70vh] w-full border-0 bg-white"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setIframeLoaded(true)}
          />
        </article>
      ) : (
        <article className="rounded-[15px] border p-4 text-sm" style={cardStyle}>
          <p className={detailClass}>
            No se pudo cargar Cursos dentro de la app. Se abrio en el navegador externo.
          </p>
        </article>
      )}
    </section>
  )
}
