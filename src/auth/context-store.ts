import { createContext } from 'react'
import type { UserRole } from '../db/database'

interface LoginInput {
  username: string
  password: string
}

export interface AuthUserProfile {
  username: string
  email: string
  fullName: string
}

export interface AuthContextValue {
  role: UserRole | null
  userProfile: AuthUserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  sessionStatus: 'validated' | 'local' | 'reauth'
  login: (input: LoginInput) => Promise<UserRole>
  loginDemo: (role: UserRole) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
