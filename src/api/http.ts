import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosRequestHeaders,
} from 'axios'
import { clearSession, getSession } from '../auth/session'
import { db } from '../db/database'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class OfflineError extends Error {
  constructor(message = 'Sin conexion a internet.') {
    super(message)
    this.name = 'OfflineError'
  }
}

export function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof OfflineError) {
    return true
  }

  if (!axios.isAxiosError(error)) {
    return false
  }

  if (!error.response) {
    return true
  }

  return error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
}

function ensureOnline(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OfflineError()
  }
}

async function attachToken(
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  const session = await getSession()
  if (!session) {
    return config
  }

  const headers = (config.headers || {}) as AxiosRequestHeaders
  headers.Authorization = `Token ${session.access_token}`
  config.headers = headers
  return config
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
})

http.interceptors.request.use(async (config) => {
  ensureOnline()
  return attachToken(config)
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await clearSession()
    }
    return Promise.reject(error)
  },
)

export async function isOnline(): Promise<boolean> {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export async function clearLocalData(): Promise<void> {
  await db.outbox.clear()
  await db.notes.clear()
  await db.space_collaborators.clear()
  await db.rendicion_files.clear()
  await db.rendiciones.clear()
  await clearSession()
}
