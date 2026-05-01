import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import sisocDarkMode from '../assets/images/sisoc_dark_mode.png'
import sisocLightMode from '../assets/images/sisoc_light_mode.png'
import { SafeScreen } from '../ui/SafeScreen'
import { useAppTheme } from '../ui/ThemeContext'
import { AppLoadingSpinner } from '../ui/AppLoadingSpinner'
import { LargeBlueButton } from '../ui/buttons'
import { LoginInputField } from './LoginFormPage'
import { getHomePathForRole } from './roleRouting'
import { useAuth } from './useAuth'

export function PasswordChangeRequiredPage() {
  const { completeRequiredPasswordChange, role, userProfile } = useAuth()
  const { isDark } = useAppTheme()
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (role && !userProfile?.mustChangePassword) {
      navigate(getHomePathForRole(role), { replace: true })
    }
  }, [navigate, role, userProfile?.mustChangePassword])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Las contrase?as no coinciden.')
      return
    }

    setLoading(true)
    try {
      await completeRequiredPasswordChange(newPassword)
      if (role) {
        navigate(getHomePathForRole(role), { replace: true })
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo actualizar la contrase?a.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeScreen
      withBasePadding
      className="flex min-h-[100dvh] items-center justify-center"
      style={{
        background: isDark
          ? 'linear-gradient(180deg, #3E5A7E 0%, #314A69 100%)'
          : 'linear-gradient(180deg, #F7F8FB 0%, #EFF2F8 100%)',
      }}
    >
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div
            className={`mb-5 rounded-2xl border px-5 py-4 text-sm ${
              isDark
                ? 'border-white/15 bg-white/10 text-white'
                : 'border-[#D9E0EC] bg-white text-[#232D4F]'
            }`}
          >
            <p className="font-semibold">Cambio obligatorio de contrase?a</p>
            <p className={`mt-2 ${isDark ? 'text-white/80' : 'text-[#5E6782]'}`}>
              {userProfile?.fullName || userProfile?.username || 'Tu usuario'} debe definir una
              nueva contrase?a para continuar.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-[#F2B8B5] bg-[#7A1C1C]/50 p-3 text-sm text-white">
              {error}
            </div>
          ) : null}

          <div className="mb-4">
            <LoginInputField
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Nueva contrase?a"
              disabled={loading}
              required
              icon={<FontAwesomeIcon icon={faLock} aria-hidden="true" style={{ fontSize: 17 }} />}
            />
          </div>

          <div className="mb-8">
            <LoginInputField
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repetir nueva contrase?a"
              disabled={loading}
              required
              icon={<FontAwesomeIcon icon={faLock} aria-hidden="true" style={{ fontSize: 17 }} />}
            />
          </div>

          <div className="mb-6 flex justify-center">
            <LargeBlueButton type="submit" disabled={loading} className="w-full max-w-[292px]">
              {loading ? 'Guardando...' : 'Guardar contrase?a'}
            </LargeBlueButton>
          </div>

          {loading ? (
            <div
              className={`-mt-1 mb-6 flex flex-col items-center gap-2 ${
                isDark ? 'text-white' : 'text-[#232D4F]'
              }`}
            >
              <AppLoadingSpinner size={44} />
              <p className="text-[13px] font-semibold">Actualizando credenciales</p>
            </div>
          ) : null}
        </form>

        <div className="mt-10 flex justify-center">
          <img
            src={isDark ? sisocDarkMode : sisocLightMode}
            alt="SISOC"
            className="h-auto w-[108px] object-contain"
            draggable={false}
          />
        </div>
      </div>
    </SafeScreen>
  )
}



