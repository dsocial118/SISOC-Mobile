import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../db/database'
import { useAuth } from './useAuth'
import { getHomePathForRole } from './roleRouting'
import { FullScreenPageLoader } from '../ui/FullScreenPageLoader'

export function ProtectedRoute({ allowed }: { allowed: UserRole[] }) {
  const { isLoading, isAuthenticated, role } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FullScreenPageLoader />
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  if (!allowed.includes(role)) {
    return <Navigate to={getHomePathForRole(role)} replace />
  }

  return <Outlet />
}
