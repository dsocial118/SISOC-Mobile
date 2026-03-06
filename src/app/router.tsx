import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { BrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { useAuth } from '../auth/useAuth'
import { AppLayout } from '../ui/AppLayout'
import { FullScreenPageLoader } from '../ui/FullScreenPageLoader'

const LoginFormPage = lazy(() =>
  import('../auth/LoginFormPage').then((module) => ({ default: module.LoginFormPage })),
)
const NoteDemoPage = lazy(() =>
  import('../features/notes/NoteDemoPage').then((module) => ({ default: module.NoteDemoPage })),
)
const OrganizationHomePage = lazy(() =>
  import('../features/home/OrganizationHomePage').then((module) => ({
    default: module.OrganizationHomePage,
  })),
)
const SpaceHubPage = lazy(() =>
  import('../features/home/SpaceHubPage').then((module) => ({
    default: module.SpaceHubPage,
  })),
)
const SpaceDetailPage = lazy(() =>
  import('../features/home/SpaceDetailPage').then((module) => ({
    default: module.SpaceDetailPage,
  })),
)
const SpaceModulePlaceholderPage = lazy(() =>
  import('../features/home/SpaceModulePlaceholderPage').then((module) => ({
    default: module.SpaceModulePlaceholderPage,
  })),
)
const SpaceActivitiesPage = lazy(() =>
  import('../features/home/SpaceActivitiesPage').then((module) => ({
    default: module.SpaceActivitiesPage,
  })),
)
const SpaceNominaPage = lazy(() =>
  import('../features/home/SpaceNominaPage').then((module) => ({
    default: module.SpaceNominaPage,
  })),
)
const HomePlaceholderPage = lazy(() =>
  import('../features/home/HomePlaceholderPage').then((module) => ({
    default: module.HomePlaceholderPage,
  })),
)
const SyncCenterPage = lazy(() =>
  import('../features/sync/SyncCenterPage').then((module) => ({
    default: module.SyncCenterPage,
  })),
)
const PreLoginPage = lazy(() =>
  import('../prelogin/PreLoginPage').then((module) => ({ default: module.PreLoginPage })),
)

function PublicPageLoader({ children }: { children: ReactNode }) {
  const { isLoading } = useAuth()

  if (isLoading) {
    return <FullScreenPageLoader />
  }

  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <InitialEntryRedirect />
      <Suspense fallback={<FullScreenPageLoader />}>
        <Routes>
          <Route
            path="/"
            element={
              <PublicPageLoader>
                <PreLoginPage />
              </PublicPageLoader>
            }
          />
          <Route
            path="/login"
            element={
              <PublicPageLoader>
                <LoginFormPage />
              </PublicPageLoader>
            }
          />

          <Route element={<ProtectedRoute allowed={['user']} />}>
            <Route
              path="/app-user/*"
              element={<AppLayout title="App Usuario" roleLabel="Usuario comun" />}
            >
              <Route index element={<NoteDemoPage />} />
              <Route path="notas" element={<NoteDemoPage />} />
              <Route path="mensajes" element={<HomePlaceholderPage title="Mensajes" />} />
              <Route path="sincronizacion" element={<SyncCenterPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowed={['org']} />}>
            <Route
              path="/app-org/*"
              element={<AppLayout title="App Organización" roleLabel="Organización" />}
            >
              <Route index element={<OrganizationHomePage />} />
              <Route path="espacios" element={<Navigate to="/app-org" replace />} />
              <Route path="espacios/:spaceId" element={<SpaceHubPage />} />
              <Route path="espacios/:spaceId/hub" element={<SpaceHubPage />} />
              <Route path="espacios/:spaceId/informacion" element={<SpaceDetailPage />} />
              <Route
                path="espacios/:spaceId/mensajes"
                element={<SpaceModulePlaceholderPage moduleTitle="Mensajes" />}
              />
              <Route
                path="espacios/:spaceId/actividades"
                element={<SpaceActivitiesPage />}
              />
              <Route
                path="espacios/:spaceId/nomina"
                element={<SpaceNominaPage />}
              />
              <Route
                path="espacios/:spaceId/rendicion"
                element={<SpaceModulePlaceholderPage moduleTitle="Rendición de Cuentas" />}
              />
              <Route path="mensajes" element={<HomePlaceholderPage title="Mensajes" />} />
              <Route path="sincronizacion" element={<SyncCenterPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function InitialEntryRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (redirectedRef.current) {
      return
    }
    redirectedRef.current = true
    if (location.pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [location.pathname, navigate])

  return null
}

