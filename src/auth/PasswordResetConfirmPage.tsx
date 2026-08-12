import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { confirmPasswordResetRequest } from '../api/authApi'
import { SafeScreen } from '../ui/SafeScreen'
import { useAppTheme } from '../ui/ThemeContext'
import { LargeBlueButton } from '../ui/buttons'
import { LoginInputField } from './LoginFormPage'

export function PasswordResetConfirmPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isDark } = useAppTheme()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!uid || !token) {
      setError('El enlace de recuperación es inválido o está incompleto.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    try {
      await confirmPasswordResetRequest({ uid, token, newPassword })
      setSuccess(true)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo restablecer la contraseña.',
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
        <div className={`mb-5 rounded-2xl border px-5 py-4 text-sm ${
          isDark ? 'border-white/15 bg-white/10 text-white' : 'border-[#D9E0EC] bg-white text-[#232D4F]'
        }`}>
          <p className="font-semibold">Restablecer contraseña</p>
          <p className={`mt-2 ${isDark ? 'text-white/80' : 'text-[#5E6782]'}`}>
            Ingresá y confirmá tu nueva contraseña.
          </p>
        </div>

        {success ? (
          <div className="rounded-lg border border-[#2E7D32]/20 bg-[#2E7D32]/10 p-4 text-sm text-[#2E7D32]">
            <p className="mb-4 font-semibold">Tu contraseña fue actualizada correctamente.</p>
            <LargeBlueButton type="button" onClick={() => navigate('/login')} className="w-full">
              Volver al login
            </LargeBlueButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error ? <div className="mb-4 rounded-lg border border-[#F2B8B5] bg-[#7A1C1C]/50 p-3 text-sm text-white">{error}</div> : null}
            <div className="mb-4">
              <LoginInputField id="reset-new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nueva contraseña" disabled={loading} required icon={<FontAwesomeIcon icon={faLock} aria-hidden="true" />} />
            </div>
            <div className="mb-8">
              <LoginInputField id="reset-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repetir nueva contraseña" disabled={loading} required icon={<FontAwesomeIcon icon={faLock} aria-hidden="true" />} />
            </div>
            <LargeBlueButton type="submit" disabled={loading} className="w-full">
              {loading ? 'Guardando...' : 'Restablecer contraseña'}
            </LargeBlueButton>
          </form>
        )}
      </div>
    </SafeScreen>
  )
}
