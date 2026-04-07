import {
  db,
  type SessionUserProfile,
  type UserRole,
  type UserSessionRecord,
} from '../db/database'

export function buildSessionUserKey(params: {
  role: UserRole
  user_profile?: SessionUserProfile | null
}): string {
  const username = String(params.user_profile?.username || 'anon').trim().toLowerCase()
  return `${params.role}:${username || 'anon'}`
}

export async function getCurrentUserKey(): Promise<string | null> {
  const session = await getSession()
  return session?.user_key || null
}

async function claimLegacyOfflineDataForUser(userKey: string): Promise<void> {
  await db.transaction(
    'rw',
    db.outbox,
    db.space_collaborators,
    db.rendiciones,
    db.rendicion_files,
    async () => {
      const legacyOutbox = await db.outbox.filter((row) => !row.user_key).toArray()
      const legacyCollaborators = await db.space_collaborators
        .filter((row) => !row.user_key)
        .toArray()
      const legacyRendiciones = await db.rendiciones.filter((row) => !row.user_key).toArray()
      const legacyFiles = await db.rendicion_files.filter((row) => !row.user_key).toArray()

      await Promise.all(
        legacyOutbox.map((row) => db.outbox.update(row.id as number, { user_key: userKey })),
      )
      await Promise.all(
        legacyCollaborators.map((row) =>
          db.space_collaborators.update(row.id, { user_key: userKey }),
        ),
      )
      await Promise.all(
        legacyRendiciones.map((row) => db.rendiciones.update(row.id, { user_key: userKey })),
      )
      await Promise.all(
        legacyFiles.map((row) => db.rendicion_files.update(row.id, { user_key: userKey })),
      )
    },
  )
}

export async function getSession(): Promise<UserSessionRecord | null> {
  return (await db.users_session.get('current')) ?? null
}

export async function saveSession(params: {
  access_token: string
  role: UserRole
  user_profile?: SessionUserProfile | null
}): Promise<UserSessionRecord> {
  const userKey = buildSessionUserKey(params)
  const session: UserSessionRecord = {
    id: 'current',
    access_token: params.access_token,
    role: params.role,
    user_key: userKey,
    user_profile: params.user_profile ?? null,
    updated_at: new Date().toISOString(),
  }
  await db.users_session.put(session)
  await claimLegacyOfflineDataForUser(userKey)
  return session
}

export async function clearSession(): Promise<void> {
  await db.users_session.delete('current')
}
