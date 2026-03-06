import { createContext, useContext } from 'react'

interface PageLoadingContextValue {
  setPageLoading: (loading: boolean) => void
}

export const PageLoadingContext = createContext<PageLoadingContextValue | null>(null)

export function usePageLoading() {
  const context = useContext(PageLoadingContext)
  if (!context) {
    throw new Error('usePageLoading debe usarse dentro de AppLayout.')
  }
  return context
}
