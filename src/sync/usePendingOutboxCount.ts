import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'
import { getCurrentUserKey } from '../auth/session'

export function usePendingOutboxCount(): number {
  const count = useLiveQuery(async () => {
    const userKey = await getCurrentUserKey()
    if (!userKey) {
      return 0
    }
    const rows = await db.outbox.where('status').anyOf(['pending', 'failed', 'processing']).toArray()
    return rows.filter((row) => row.user_key === userKey).length
  }, [])
  return count ?? 0
}
