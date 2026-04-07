import { db, type OutboxRecord } from '../db/database'
import { getCurrentUserKey } from '../auth/session'

export async function enqueueOutbox(
  input: Omit<OutboxRecord, 'id' | 'status' | 'created_at' | 'attempts'>,
): Promise<number> {
  const userKey = await getCurrentUserKey()
  return db.outbox.add({
    ...input,
    user_key: input.user_key ?? userKey,
    status: 'pending',
    created_at: new Date().toISOString(),
    attempts: 0,
    next_retry_at: null,
    last_error: null,
  })
}
