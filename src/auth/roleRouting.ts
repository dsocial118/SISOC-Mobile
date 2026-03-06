import type { UserRole } from '../db/database'

const roleHomePaths: Record<UserRole, string> = {
  user: '/app-user',
  org: '/app-org',
}

export function getHomePathForRole(role: UserRole): string {
  return roleHomePaths[role]
}
