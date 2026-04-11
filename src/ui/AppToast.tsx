import { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'

type AppToastProps = {
  open: boolean
  message: string
  tone: 'success' | 'error'
  onClose: () => void
  durationMs?: number
}

export function AppToast({
  open,
  message,
  tone,
  onClose,
  durationMs = 4000,
}: AppToastProps) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      onClose()
    }, durationMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [durationMs, onClose, open])

  if (!open || !message.trim()) {
    return null
  }

  const isSuccess = tone === 'success'
  const containerClass = isSuccess
    ? 'border-[#2E7D33]/30 bg-[#2E7D33] text-white shadow-[0_18px_40px_rgba(46,125,51,0.35)]'
    : 'border-[#C62828]/30 bg-[#C62828] text-white shadow-[0_18px_40px_rgba(198,40,40,0.35)]'
  const icon = isSuccess ? faCircleCheck : faCircleExclamation

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(82px+env(safe-area-inset-top))] z-40 flex justify-center px-4">
      <div
        role="alert"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 ${containerClass}`}
      >
        <FontAwesomeIcon icon={icon} aria-hidden="true" className="mt-0.5 text-[18px]" />
        <p className="min-w-0 flex-1 text-sm font-medium leading-5">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar mensaje"
          className="shrink-0 text-white/80 transition hover:text-white"
        >
          <FontAwesomeIcon icon={faXmark} aria-hidden="true" className="text-[18px]" />
        </button>
      </div>
    </div>
  )
}
