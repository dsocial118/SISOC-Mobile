import { createContext, useContext } from 'react'

export type AppTheme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: AppTheme
  isDark: boolean
  toggleTheme: () => void
}

export const THEME_STORAGE_KEY = 'sisoc-mobile-theme'

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useAppTheme debe usarse dentro de ThemeProvider')
  }
  return context
}
