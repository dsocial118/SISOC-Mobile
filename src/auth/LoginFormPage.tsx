import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEye, faEyeSlash, faLock, faUser } from '@fortawesome/free-solid-svg-icons'
import { LargeBlueButton } from '../ui/buttons'
import { getHomePathForRole } from './roleRouting'
import { useAuth } from './useAuth'
import sisocDarkMode from '../assets/images/sisoc_dark_mode.png'
import sisocLightMode from '../assets/images/sisoc_light_mode.png'
import { AppLoadingSpinner } from '../ui/AppLoadingSpinner'
import { SafeScreen } from '../ui/SafeScreen'
import { useAppTheme } from '../ui/ThemeContext'

export function LoginFormPage() {
  const { login } = useAuth()
  const { isDark } = useAppTheme()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const role = await login({ username, password })
      navigate(getHomePathForRole(role), { replace: true })
    } catch (submitError) {
      const errorMessage =
        submitError instanceof Error
          ? submitError.message
          : 'Usuario o contraseña incorrectos'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  function handleRecoverPasswordClick() {
    setError('La recuperación de contraseña estará disponible pronto.')
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
          {error ? (
            <div className="mb-4 rounded-lg border border-[#C62828]/20 bg-[#C62828]/10 p-3 text-sm text-[#C62828]">
              {error}
            </div>
          ) : null}

          <div className="mb-4">
            <LoginInputField
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Ingresa tu usuario"
              disabled={loading}
              required
              icon={<FontAwesomeIcon icon={faUser} aria-hidden="true" style={{ fontSize: 17 }} />}
            />
          </div>

          <div className="mb-8">
            <LoginInputField
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ingresa tu contraseña"
              disabled={loading}
              required
              icon={<FontAwesomeIcon icon={faLock} aria-hidden="true" style={{ fontSize: 17 }} />}
            />
          </div>

          <div className="mb-6 flex justify-center">
            <LargeBlueButton type="submit" disabled={loading} className="w-full max-w-[292px]">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </LargeBlueButton>
          </div>
          {loading ? (
            <div
              className={`-mt-1 mb-6 flex flex-col items-center gap-2 ${
                isDark ? 'text-white' : 'text-[#232D4F]'
              }`}
            >
              <AppLoadingSpinner size={44} />
              <p className="text-[13px] font-semibold">Cargando tu información</p>
            </div>
          ) : null}

          <p className={`mb-8 text-center text-sm ${isDark ? 'text-white/80' : 'text-[#6F7180]'}`}>
            Olvidaste contraseña?{' '}
            <button
              type="button"
              onClick={handleRecoverPasswordClick}
              className={`font-semibold underline underline-offset-2 ${
                isDark ? 'text-[#E7BA61]' : 'text-[#232D4F]'
              }`}
            >
              Entrar acá
            </button>
          </p>

          <div className={`mx-auto mb-10 w-[75%] border-t ${isDark ? 'border-white/20' : 'border-[#E0E0E0]'}`} />
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

interface LoginInputFieldProps {
  id: string
  type: 'text' | 'password'
  icon: React.ReactNode
  placeholder: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  required?: boolean
}

function LoginInputField({
  id,
  type,
  icon,
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
}: LoginInputFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPasswordField = type === 'password'
  const inputType = isPasswordField && showPassword ? 'text' : type

  return (
    <div className="mx-auto flex h-[40px] w-full max-w-[292px] items-center overflow-hidden rounded-[10px] border border-[#E0E0E0] bg-[#F5F5F5]">
      <div className="flex h-[40px] w-[40px] items-center justify-center rounded-l-[10px] bg-[#232D4F] p-[2px] text-white">
        {icon}
      </div>

      <input
        id={id}
        type={inputType}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="h-full w-full border-none bg-transparent px-3 text-[14px] italic text-[#AB9898] outline-none placeholder:text-[#AB9898]"
      />

      {isPasswordField ? (
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          disabled={disabled}
          className="flex h-[40px] w-[36px] items-center justify-center text-[#232D4F] disabled:opacity-50"
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      ) : null}
    </div>
  )
}

function EyeIcon() {
  return <FontAwesomeIcon icon={faEye} aria-hidden="true" style={{ fontSize: 14 }} />
}

function EyeOffIcon() {
  return <FontAwesomeIcon icon={faEyeSlash} aria-hidden="true" style={{ fontSize: 14 }} />
}

