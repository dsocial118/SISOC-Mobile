import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faUser } from '@fortawesome/free-solid-svg-icons'
import sisocDarkMode from '../assets/images/sisoc_dark_mode.png'
import sisocLightMode from '../assets/images/sisoc_light_mode.png'
import { requestPasswordResetByUsername } from '../api/authApi'
import { AppLoadingSpinner } from '../ui/AppLoadingSpinner'
import { SafeScreen } from '../ui/SafeScreen'
import { useAppTheme } from '../ui/ThemeContext'
import { LargeBlueButton } from '../ui/buttons'
import { LoginInputField } from './LoginFormPage'

export function PasswordResetRequestPage() {
  const navigate = useNavigate()
  const { isDark } = useAppTheme()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await requestPasswordResetByUsername({ username })
      setSuccess(
        'Si el usuario existe, el pedido quedó registrado para que un administrador genere una nueva contraseña temporal.',
      )
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar la solicitud de reseteo.',
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
        <div className="mb-5">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className={`inline-flex items-center gap-2 text-sm font-semibold ${
              isDark ? 'text-white' : 'text-[#232D4F]'
            }`}
          >
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            Volver al login
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className={`mb-5 rounded-2xl border px-5 py-4 text-sm ${
              isDark
                ? 'border-white/15 bg-white/10 text-white'
                : 'border-[#D9E0EC] bg-white text-[#232D4F]'
            }`}
          >
            <p className="font-semibold">Recuperación de contraseña</p>
            <p className={`mt-2 ${isDark ? 'text-white/80' : 'text-[#5E6782]'}`}>
              Ingresá tu nombre de usuario para solicitar una nueva contraseña temporal.
            </p>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-[#C62828]/20 bg-[#C62828]/10 p-3 text-sm text-[#C62828]">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 rounded-lg border border-[#2E7D32]/20 bg-[#2E7D32]/10 p-3 text-sm text-[#2E7D32]">
              {success}
            </div>
          ) : null}

          <div className="mb-8">
            <LoginInputField
              id="reset-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ingresá tu usuario"
              disabled={loading}
              required
              icon={<FontAwesomeIcon icon={faUser} aria-hidden="true" style={{ fontSize: 17 }} />}
            />
          </div>

          <div className="mb-6 flex justify-center">
            <LargeBlueButton type="submit" disabled={loading} className="w-full max-w-[292px]">
              {loading ? 'Enviando...' : 'Pedir reseteo'}
            </LargeBlueButton>
          </div>

          {loading ? (
            <div
              className={`-mt-1 mb-6 flex flex-col items-center gap-2 ${
                isDark ? 'text-white' : 'text-[#232D4F]'
              }`}
            >
              <AppLoadingSpinner size={44} />
              <p className="text-[13px] font-semibold">Registrando solicitud</p>
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
