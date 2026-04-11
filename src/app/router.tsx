import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginFormPage } from '../auth/LoginFormPage'
import { PasswordChangeRequiredPage } from '../auth/PasswordChangeRequiredPage'
import { PasswordResetRequestPage } from '../auth/PasswordResetRequestPage'
import { MOBILE_RENDICION_PERMISSION } from '../auth/permissionCodes'
import { ProtectedRoute } from '../auth/ProtectedRoute'
import { AppLayout } from '../ui/AppLayout'
import { FullScreenPageLoader } from '../ui/FullScreenPageLoader'

const NoteDemoPage = lazy(() =>
  import('../features/notes/NoteDemoPage').then((module) => ({ default: module.NoteDemoPage })),
)
const OrganizationHomePage = lazy(() =>
  import('../features/home/OrganizationHomePage').then((module) => ({
    default: module.OrganizationHomePage,
  })),
)
const OrganizationMessagesPage = lazy(() =>
  import('../features/home/OrganizationMessagesPage').then((module) => ({
    default: module.OrganizationMessagesPage,
  })),
)
const OrganizationNotificationsPage = lazy(() =>
  import('../features/home/OrganizationNotificationsPage').then((module) => ({
    default: module.OrganizationNotificationsPage,
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
const SpaceRelevamientoDetailPage = lazy(() =>
  import('../features/home/SpaceRelevamientoDetailPage').then((module) => ({
    default: module.SpaceRelevamientoDetailPage,
  })),
)
const SpaceCapacitacionesPage = lazy(() =>
  import('../features/home/SpaceCapacitacionesPage').then((module) => ({
    default: module.SpaceCapacitacionesPage,
  })),
)
const SpaceMessagesPage = lazy(() =>
  import('../features/home/SpaceMessagesPage').then((module) => ({
    default: module.SpaceMessagesPage,
  })),
)
const SpaceMessageDetailPage = lazy(() =>
  import('../features/home/SpaceMessageDetailPage').then((module) => ({
    default: module.SpaceMessageDetailPage,
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
const SpaceNominaAlimentariaPage = lazy(() =>
  import('../features/home/SpaceNominaAlimentariaPage').then((module) => ({
    default: module.SpaceNominaAlimentariaPage,
  })),
)
const SpaceNominaAlimentariaPersonFormPage = lazy(() =>
  import('../features/home/SpaceNominaAlimentariaPersonFormPage').then((module) => ({
    default: module.SpaceNominaAlimentariaPersonFormPage,
  })),
)
const SpaceNominaAlimentariaPersonDetailPage = lazy(() =>
  import('../features/home/SpaceNominaAlimentariaPersonDetailPage').then((module) => ({
    default: module.SpaceNominaAlimentariaPersonDetailPage,
  })),
)
const SpaceNominaAlimentariaAttendancePage = lazy(() =>
  import('../features/home/SpaceNominaAlimentariaAttendancePage').then((module) => ({
    default: module.SpaceNominaAlimentariaAttendancePage,
  })),
)
const SpaceNominaPersonDetailPage = lazy(() =>
  import('../features/home/SpaceNominaPersonDetailPage').then((module) => ({
    default: module.SpaceNominaPersonDetailPage,
  })),
)
const SpaceNominaPersonFormPage = lazy(() =>
  import('../features/home/SpaceNominaPersonFormPage').then((module) => ({
    default: module.SpaceNominaPersonFormPage,
  })),
)
const SpaceRendicionPage = lazy(() =>
  import('../features/home/SpaceRendicionPage').then((module) => ({
    default: module.SpaceRendicionPage,
  })),
)
const RendicionContextPage = lazy(() =>
  import('../features/home/RendicionContextPage').then((module) => ({
    default: module.RendicionContextPage,
  })),
)
const SpaceRendicionFormPage = lazy(() =>
  import('../features/home/SpaceRendicionFormPage').then((module) => ({
    default: module.SpaceRendicionFormPage,
  })),
)
const SpaceRendicionDetailPage = lazy(() =>
  import('../features/home/SpaceRendicionDetailPage').then((module) => ({
    default: module.SpaceRendicionDetailPage,
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

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenPageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginFormPage />} />
          <Route path="/password-reset-request" element={<PasswordResetRequestPage />} />

          <Route element={<ProtectedRoute allowed={['user', 'org']} />}>
            <Route path="/password-change-required" element={<PasswordChangeRequiredPage />} />
          </Route>

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
                path="espacios/:spaceId/informacion/relevamiento"
                element={<SpaceRelevamientoDetailPage />}
              />
              <Route
                path="espacios/:spaceId/informacion/capacitaciones"
                element={<SpaceCapacitacionesPage />}
              />
              <Route path="espacios/:spaceId/mensajes" element={<SpaceMessagesPage />} />
              <Route
                path="espacios/:spaceId/mensajes/:messageId"
                element={<SpaceMessageDetailPage />}
              />
              <Route path="notificaciones" element={<OrganizationNotificationsPage />} />
              <Route path="espacios/:spaceId/actividades" element={<SpaceActivitiesPage />} />
              <Route path="espacios/:spaceId/nomina" element={<SpaceNominaPage />} />
              <Route
                path="espacios/:spaceId/nomina-alimentaria"
                element={<SpaceNominaAlimentariaPage />}
              />
              <Route
                path="espacios/:spaceId/nomina-alimentaria/nueva"
                element={<SpaceNominaAlimentariaPersonFormPage />}
              />
              <Route
                path="espacios/:spaceId/nomina-alimentaria/asistencia"
                element={<SpaceNominaAlimentariaAttendancePage />}
              />
              <Route
                path="espacios/:spaceId/nomina-alimentaria/:nominaId"
                element={<SpaceNominaAlimentariaPersonDetailPage />}
              />
              <Route
                path="espacios/:spaceId/nomina/nueva"
                element={<SpaceNominaPersonFormPage />}
              />
              <Route
                path="espacios/:spaceId/nomina/:nominaId"
                element={<SpaceNominaPersonDetailPage />}
              />
              <Route
                path="espacios/:spaceId/nomina/:nominaId/editar"
                element={<SpaceNominaPersonFormPage />}
              />
              <Route
                path="espacios/:spaceId/nomina/:nominaId/actividades"
                element={<SpaceNominaPersonFormPage />}
              />
              <Route path="mensajes" element={<OrganizationMessagesPage />} />
              <Route path="sincronizacion" element={<SyncCenterPage />} />
              <Route
                element={
                  <ProtectedRoute
                    allowed={['org']}
                    requiredPermissions={[MOBILE_RENDICION_PERMISSION]}
                  />
                }
              >
                <Route path="rendicion" element={<RendicionContextPage />} />
                <Route path="espacios/:spaceId/rendicion" element={<SpaceRendicionPage />} />
                <Route
                  path="espacios/:spaceId/rendicion/nueva"
                  element={<SpaceRendicionFormPage />}
                />
                <Route
                  path="espacios/:spaceId/rendicion/:rendicionId"
                  element={<SpaceRendicionDetailPage />}
                />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
