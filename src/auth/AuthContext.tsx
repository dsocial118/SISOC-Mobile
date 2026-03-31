import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  changeRequiredPasswordRequest,
  getRoleFromCurrentToken,
  loginRequest,
  logoutRequest,
} from '../api/authApi'
import { isTransientNetworkError } from '../api/http'
import type { UserRole } from '../db/database'
import { clearOrganizationSpacesCache } from '../features/home/organizationSpacesCache'
import { clearSession, getSession, saveSession } from './session'
import {
  AuthContext,
  type AuthContextValue,
  type AuthUserProfile,
} from './context-store'

interface LoginInput {
  username: string
  password: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null)
  const [userProfile, setUserProfile] = useState<AuthUserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionStatus, setSessionStatus] = useState<'validated' | 'local' | 'reauth'>(
    'validated',
  )

  const validateStoredSession = useCallback(async () => {
    const session = await getSession()
    if (!session) {
      setRole(null)
      setUserProfile(null)
      setSessionStatus('validated')
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setRole(session.role)
      setUserProfile(session.user_profile ?? null)
      setSessionStatus('local')
      return
    }

    try {
      const validated = await getRoleFromCurrentToken(session.access_token)
      if (
        validated.role !== session.role
        || validated.user_profile.username !== session.user_profile?.username
        || validated.user_profile.email !== session.user_profile?.email
        || validated.user_profile.fullName !== session.user_profile?.fullName
        || validated.user_profile.mustChangePassword !== session.user_profile?.mustChangePassword
        || JSON.stringify(validated.user_profile.permissions)
          !== JSON.stringify(session.user_profile?.permissions ?? [])
      ) {
        await saveSession({
          access_token: session.access_token,
          role: validated.role,
          user_profile: validated.user_profile,
        })
      }

      setRole(validated.role)
      setUserProfile(validated.user_profile)
      setSessionStatus('validated')
    } catch (error) {
      if (isTransientNetworkError(error)) {
        setRole(session.role)
        setUserProfile(session.user_profile ?? null)
        setSessionStatus('local')
        return
      }

      await clearSession()
      setRole(null)
      setUserProfile(null)
      setSessionStatus('reauth')
    }
  }, [])

  useEffect(() => {
    async function bootstrap() {
      await validateStoredSession()
      setIsLoading(false)
    }

    void bootstrap()
  }, [validateStoredSession])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    function handleOnline() {
      void validateStoredSession()
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [validateStoredSession])

  const login = useCallback(async (input: LoginInput) => {
    const session = await loginRequest(input)
    await saveSession(session)
    setRole(session.role)
    setUserProfile(session.user_profile)
    setSessionStatus('validated')
    return session.role
  }, [])

  const loginDemo = useCallback(async (nextRole: UserRole) => {
    await saveSession({
      access_token: `demo-token-${nextRole}`,
      role: nextRole,
        user_profile: {
          username: `demo_${nextRole}`,
          email: '',
          fullName: nextRole === 'org' ? 'Demo Organización' : 'Demo Usuario',
          mustChangePassword: false,
          permissions: [],
        },
    })
    setRole(nextRole)
    setUserProfile({
      username: `demo_${nextRole}`,
      email: '',
      fullName: nextRole === 'org' ? 'Demo Organización' : 'Demo Usuario',
      mustChangePassword: false,
      permissions: [],
    })
    setSessionStatus('local')
  }, [])

  const completeRequiredPasswordChange = useCallback(async (newPassword: string) => {
    const session = await getSession()
    if (!session) {
      throw new Error('La sesión expiró. Volvé a ingresar.')
    }

    await changeRequiredPasswordRequest({
      token: session.access_token,
      newPassword,
    })

    const nextProfile = session.user_profile
      ? { ...session.user_profile, mustChangePassword: false }
      : userProfile
        ? { ...userProfile, mustChangePassword: false }
        : null

    await saveSession({
      access_token: session.access_token,
      role: session.role,
      user_profile: nextProfile,
    })
    setUserProfile(nextProfile)
    setSessionStatus('validated')
  }, [userProfile])

  const logout = useCallback(async () => {
    const session = await getSession()
    await clearSession()
    clearOrganizationSpacesCache()
    setRole(null)
    setUserProfile(null)
    setSessionStatus('validated')

    if (session && typeof navigator !== 'undefined' && navigator.onLine) {
      void logoutRequest(session.access_token).catch(() => {
        // Ignorar fallo remoto: la sesión local ya fue limpiada.
      })
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      userProfile,
      isLoading,
      isAuthenticated: Boolean(role),
      sessionStatus,
      login,
      loginDemo,
      completeRequiredPasswordChange,
      logout,
    }),
    [
      role,
      userProfile,
      isLoading,
      sessionStatus,
      login,
      loginDemo,
      completeRequiredPasswordChange,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

