import axios from 'axios'
import type { AuthUserProfile } from '../auth/context-store'
import type { UserRole } from '../db/database'
import { parseApiError } from './errorUtils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

interface LoginResponse {
  token: string
  token_type: string
  user_id: number
  username: string
}

interface MeResponse {
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  pwa?: {
    roles?: string[]
    must_change_password?: boolean
  }
  permissions?: string[]
}

export async function loginRequest(params: {
  username: string
  password: string
}): Promise<{ access_token: string; role: UserRole; user_profile: AuthUserProfile }> {
  try {
    const loginResponse = await axios.post<LoginResponse>(`${API_BASE_URL}/users/login/`, {
      username: params.username,
      password: params.password,
    })

    const backendToken = loginResponse.data.token
    const meResponse = await axios.get<MeResponse>(`${API_BASE_URL}/users/me/`, {
      headers: {
        Authorization: `Token ${backendToken}`,
      },
    })

    return {
      access_token: backendToken,
      role: mapRoleFromMe(meResponse.data),
      user_profile: mapUserProfile(meResponse.data, loginResponse.data.username),
    }
  } catch (error) {
    throw new Error(parseApiError(error, 'No se pudo iniciar sesión.'))
  }
}

export async function getRoleFromCurrentToken(
  token: string,
): Promise<{ role: UserRole; user_profile: AuthUserProfile }> {
  const meResponse = await axios.get<MeResponse>(`${API_BASE_URL}/users/me/`, {
    headers: {
      Authorization: `Token ${token}`,
    },
  })
  return {
    role: mapRoleFromMe(meResponse.data),
    user_profile: mapUserProfile(meResponse.data),
  }
}

export async function logoutRequest(token: string): Promise<void> {
  await axios.post(
    `${API_BASE_URL}/users/logout/`,
    {},
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    },
  )
}

export async function changeRequiredPasswordRequest(params: {
  token: string
  newPassword: string
}): Promise<void> {
  try {
    await axios.post(
      `${API_BASE_URL}/users/password-change-required/`,
      { new_password: params.newPassword },
      {
        headers: {
          Authorization: `Token ${params.token}`,
        },
      },
    )
  } catch (error) {
    throw new Error(parseApiError(error, 'No se pudo actualizar la contraseña.'))
  }
}

export async function requestPasswordResetByUsername(params: {
  username: string
}): Promise<void> {
  try {
    await axios.post(`${API_BASE_URL}/users/password-reset/request/`, {
      username: params.username,
    })
  } catch (error) {
    throw new Error(
      parseApiError(error, 'No se pudo registrar la solicitud de reseteo.'),
    )
  }
}

function mapRoleFromMe(meData: MeResponse): UserRole {
  const roles = meData.pwa?.roles ?? []
  if (roles.includes('representante')) {
    return 'org'
  }
  if (roles.includes('operador')) {
    return 'user'
  }
  throw new Error('El usuario autenticado no tiene roles PWA activos.')
}

function mapUserProfile(meData: MeResponse, fallbackUsername = ''): AuthUserProfile {
  const firstName = (meData.first_name || '').trim()
  const lastName = (meData.last_name || '').trim()
  const fullName = `${firstName} ${lastName}`.trim()
  return {
    username: (meData.username || fallbackUsername || 'usuario').trim(),
    email: (meData.email || '').trim(),
    fullName: fullName || (meData.username || fallbackUsername || 'Usuario'),
    mustChangePassword: Boolean(meData.pwa?.must_change_password),
    permissions: [...(meData.permissions ?? [])].sort(),
  }
}
