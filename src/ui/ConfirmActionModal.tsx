import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useAppTheme } from './ThemeContext'
import { appButtonClass, joinClasses } from './buttons'

type ConfirmActionModalProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmActionModalProps) {
  const { isDark } = useAppTheme()
  const textClass = isDark ? 'text-white/80' : 'text-slate-600'

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <button
        type="button"
        aria-label="Cerrar confirmación"
        className="absolute inset-0 cursor-default"
        onClick={onCancel}
      />
      <div
        className={`relative w-full max-w-md rounded-[28px] border px-5 py-6 ${
          isDark
            ? 'border-white/15 bg-[#1B2238] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
            : 'border-slate-200 bg-white text-[#232D4F] shadow-[0_24px_80px_rgba(15,23,42,0.18)]'
        }`}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-3xl text-[#B45309]">
          <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
        </div>
        <h3 className="text-[18px] font-semibold">{title}</h3>
        <p className={`mt-2 text-sm ${textClass}`}>{message}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={joinClasses(
              appButtonClass({ variant: 'outline-secondary', size: 'lg' }),
              isDark ? 'bg-white/5 text-white border-white/20 hover:bg-white/10' : undefined,
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={appButtonClass({ variant: 'success', size: 'lg' })}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
