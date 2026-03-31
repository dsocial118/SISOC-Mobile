import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../db/database'
import { FullScreenPageLoader } from '../ui/FullScreenPageLoader'
import { getHomePathForRole } from './roleRouting'
import { useAuth } from './useAuth'

export function ProtectedRoute({
  allowed,
  requiredPermissions = [],
}: {
  allowed: UserRole[]
  requiredPermissions?: string[]
}) {
  const { isLoading, isAuthenticated, role, userProfile } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FullScreenPageLoader />
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!allowed.includes(role)) {
    return <Navigate to={getHomePathForRole(role)} replace />
  }

  if (userProfile?.mustChangePassword && location.pathname !== '/password-change-required') {
    return <Navigate to="/password-change-required" replace />
  }

  if (
    requiredPermissions.length > 0
    && !requiredPermissions.every((permission) => userProfile?.permissions?.includes(permission))
  ) {
    return <Navigate to={getHomePathForRole(role)} replace />
  }

  return <Outlet />
}
