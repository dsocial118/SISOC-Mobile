import { db, type OutboxRecord } from '../db/database'

export async function enqueueOutbox(
  input: Omit<OutboxRecord, 'id' | 'status' | 'created_at' | 'attempts'>,
): Promise<number> {
  return db.outbox.add({
    ...input,
    status: 'pending',
    created_at: new Date().toISOString(),
    attempts: 0,
    next_retry_at: null,
    last_error: null,
  })
}
