import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useAppTheme } from './ThemeContext'
import { appButtonClass } from './buttons'

type NoticeModalProps = {
  open: boolean
  title: string
  message: string
  closeLabel?: string
  onClose: () => void
}

export function NoticeModal({
  open,
  title,
  message,
  closeLabel = 'Entendido',
  onClose,
}: NoticeModalProps) {
  const { isDark } = useAppTheme()
  const textClass = isDark ? 'text-white/80' : 'text-slate-600'

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-[28px] border px-5 py-6 ${
          isDark
            ? 'border-white/15 bg-[#1B2238] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
            : 'border-slate-200 bg-white text-[#232D4F] shadow-[0_24px_80px_rgba(15,23,42,0.18)]'
        }`}
      >
        <div className="mb-4 flex justify-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#E7BA61]/18 text-[#B7791F]">
            <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" className="text-[30px]" />
          </div>
        </div>
        <h3 className="text-center text-[18px] font-semibold">{title}</h3>
        <p className={`mt-2 text-center text-sm ${textClass}`}>{message}</p>
        <button
          type="button"
          onClick={onClose}
          className={`mt-5 ${appButtonClass({ variant: 'primary', size: 'lg', fullWidth: true })}`}
        >
          {closeLabel}
        </button>
      </div>
    </div>
  )
}
