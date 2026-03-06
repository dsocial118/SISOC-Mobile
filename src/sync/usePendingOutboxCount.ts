import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/database'

export function usePendingOutboxCount(): number {
  const count = useLiveQuery(async () => {
    return db.outbox.where('status').anyOf(['pending', 'failed', 'processing']).count()
  }, [])
  return count ?? 0
}
