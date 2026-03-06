import {
  db,
  type SessionUserProfile,
  type UserRole,
  type UserSessionRecord,
} from '../db/database'

export async function getSession(): Promise<UserSessionRecord | null> {
  return (await db.users_session.get('current')) ?? null
}

export async function saveSession(params: {
  access_token: string
  role: UserRole
  user_profile?: SessionUserProfile | null
}): Promise<UserSessionRecord> {
  const session: UserSessionRecord = {
    id: 'current',
    access_token: params.access_token,
    role: params.role,
    user_profile: params.user_profile ?? null,
    updated_at: new Date().toISOString(),
  }
  await db.users_session.put(session)
  return session
}

export async function clearSession(): Promise<void> {
  await db.users_session.delete('current')
}
