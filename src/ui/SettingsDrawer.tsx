import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEnvelope,
  faMoon,
  faRightFromBracket,
  faSun,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import type { AuthUserProfile } from '../auth/context-store'
import type { AppTheme } from './ThemeContext'

interface SettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  userProfile: AuthUserProfile | null
  sessionLabel: string
  pendingCount: number
  theme: AppTheme
  onToggleTheme: () => void
  onLogout: () => void
}

export function SettingsDrawer({
  isOpen,
  onClose,
  userProfile,
  sessionLabel,
  pendingCount,
  theme,
  onToggleTheme,
  onLogout,
}: SettingsDrawerProps) {
  const userName = userProfile?.fullName || userProfile?.username || 'Usuario'
  const userEmail = userProfile?.email || 'Sin email'

  return (
    <div
      className={`fixed inset-0 z-50 transition ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-black/35 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        aria-label="Cerrar ajustes"
      />

      <aside
        className={`absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col border-r border-[#E7BA61] bg-[#232D4F] p-5 text-white shadow-[6px_0_18px_rgba(0,0,0,0.35)] transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top))',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="rounded-xl border border-white/20 bg-white/5 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#E7BA61]">
            Usuario
          </p>
          <p className="mt-2 flex items-center gap-2 text-[16px] font-semibold leading-tight">
            <FontAwesomeIcon icon={faUser} aria-hidden="true" style={{ fontSize: 16 }} />
            {userName}
          </p>
          <p className="mt-1 flex items-center gap-2 text-[12px] opacity-90">
            <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" style={{ fontSize: 14 }} />
            {userEmail}
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#E7BA61]">
            Sincronización
          </p>
          <div className="mt-3 space-y-2 text-[13px]">
            <p className="rounded-md bg-white/10 px-3 py-2">
              <span className="font-semibold">Sesión:</span> {sessionLabel}
            </p>
            <p className="rounded-md bg-white/10 px-3 py-2">
              <span className="font-semibold">Pendientes:</span> {pendingCount}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/20 bg-white/5 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#E7BA61]">
            Apariencia
          </p>
          <button
            type="button"
            onClick={onToggleTheme}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/10 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              {theme === 'dark' ? (
                <FontAwesomeIcon icon={faMoon} aria-hidden="true" style={{ fontSize: 16 }} />
              ) : (
                <FontAwesomeIcon icon={faSun} aria-hidden="true" style={{ fontSize: 16 }} />
              )}
              {theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}
            </span>
            <ThemeSwitch isDark={theme === 'dark'} />
          </button>
        </div>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#C62828] px-4 py-3 text-[14px] font-semibold text-white shadow-[0_3px_8px_rgba(0,0,0,0.3)]"
          >
            <FontAwesomeIcon
              icon={faRightFromBracket}
              aria-hidden="true"
              style={{ fontSize: 16 }}
            />
            Salir
          </button>
        </div>
      </aside>
    </div>
  )
}

function ThemeSwitch({ isDark }: { isDark: boolean }) {
  return (
    <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-black/35 p-1">
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-[#E7BA61] transition ${isDark ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </span>
  )
}

