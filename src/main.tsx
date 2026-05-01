import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext'
import { registerPwa } from './pwa/registerPwa'
import { startSyncEngine } from './sync/engine'
import { initProgressiveReveal } from './ui/progressiveReveal'
import { ThemeProvider } from './ui/ThemeContext'

const queryClient = new QueryClient()

registerPwa()
startSyncEngine()
const disposeProgressiveReveal = initProgressiveReveal()

if (typeof document !== 'undefined') {
  const preventZoomGesture = (event: Event) => {
    event.preventDefault()
  }
  let lastTouchEnd = 0

  const preventDoubleTapZoom = (event: TouchEvent) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 320) {
      event.preventDefault()
    }
    lastTouchEnd = now
  }

  document.addEventListener('gesturestart', preventZoomGesture, { passive: false })
  document.addEventListener('gesturechange', preventZoomGesture, { passive: false })
  document.addEventListener('gestureend', preventZoomGesture, { passive: false })
  document.addEventListener('touchend', preventDoubleTapZoom, { passive: false })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeProgressiveReveal()
  })
}
