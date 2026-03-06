import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCloudArrowUp,
  faExclamationTriangle,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import type { OutboxRecord } from '../../db/database'
import { db } from '../../db/database'
import { isOnline } from '../../api/http'
import { syncNow } from '../../sync/engine'
import { useAppTheme } from '../../ui/ThemeContext'
import { LargeBlueButton } from '../../ui/buttons'

type SyncListItem = {
  id: number
  label: string
  status: OutboxRecord['status']
  lastError: string | null
}

function getOutboxLabel(item: OutboxRecord): string {
  const payload = item.payload || {}
  switch (item.type) {
    case 'CREATE_NOTE':
      return `Nota: ${String(payload.name || payload.id || item.client_uuid)}`
    case 'CREATE_COLLABORATOR':
      return `Colaborador (alta): ${String((payload as { data?: { nombre?: string; apellido?: string } }).data?.nombre || '')} ${String((payload as { data?: { nombre?: string; apellido?: string } }).data?.apellido || '')}`.trim()
    case 'UPDATE_COLLABORATOR':
      return `Colaborador (edición): ${String((payload as { data?: { nombre?: string; apellido?: string } }).data?.nombre || '')} ${String((payload as { data?: { nombre?: string; apellido?: string } }).data?.apellido || '')}`.trim()
    case 'DELETE_COLLABORATOR':
      return 'Colaborador (eliminación)'
    default:
      return `Pendiente: ${item.type}`
  }
}

async function getPendingOutboxItems(): Promise<SyncListItem[]> {
  const rows = await db.outbox
    .where('status')
    .anyOf(['pending', 'failed', 'processing'])
    .toArray()
  return rows
    .filter((row): row is OutboxRecord & { id: number } => typeof row.id === 'number')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      label: getOutboxLabel(row),
      status: row.status,
      lastError: row.last_error || null,
    }))
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function SyncCenterPage() {
  const { isDark } = useAppTheme()
  const pendingItems = useLiveQuery(getPendingOutboxItems, [])
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [syncedNow, setSyncedNow] = useState<string[]>([])

  const sortedPending = useMemo(() => pendingItems ?? [], [pendingItems])

  async function runSync() {
    setSyncError('')
    const online = await isOnline()
    if (!online) {
      setSyncError('No hay conexión a internet para sincronizar.')
      return
    }

    const before = await getPendingOutboxItems()
    const tracked = new Map(before.map((item) => [item.id, item.label]))
    setSyncedNow([])
    setSyncing(true)

    try {
      for (let index = 0; index < 12; index += 1) {
        await syncNow()
        await wait(600)

        const current = await getPendingOutboxItems()
        const currentIds = new Set(current.map((item) => item.id))
        const syncedLabels: string[] = []
        for (const [trackedId, label] of tracked.entries()) {
          if (!currentIds.has(trackedId)) {
            syncedLabels.push(label)
            tracked.delete(trackedId)
          }
        }
        if (syncedLabels.length > 0) {
          setSyncedNow((previous) => [...previous, ...syncedLabels])
        }

        if (current.length === 0) {
          break
        }
      }
    } finally {
      setSyncing(false)
    }
  }

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/90' : 'text-slate-700'
  const itemClass = isDark ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white'

  return (
    <section className="grid gap-4">
      {sortedPending.length === 0 ? (
        <div className="flex min-h-[58vh] flex-col items-center justify-center">
          <div className="flex items-center justify-center">
            <FontAwesomeIcon
              icon={faCloudArrowUp}
              aria-hidden="true"
              style={{ color: '#32A852', fontSize: 82, opacity: 0.6 }}
            />
          </div>
          <p className={`mt-2 text-center text-[16px] font-semibold ${textClass}`}>Todo está sincronizado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex justify-center">
            <LargeBlueButton
              type="button"
              onClick={() => void runSync()}
              disabled={syncing}
              className="flex items-center justify-center gap-2"
            >
              <FontAwesomeIcon icon={faSpinner} spin={syncing} aria-hidden="true" style={{ fontSize: 13 }} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </LargeBlueButton>
          </div>

          {syncError ? <p className="text-xs text-[#C62828]">{syncError}</p> : null}

          <div className="grid gap-2">
            {sortedPending.map((item) => (
              <div key={item.id} className={`rounded-xl border px-3 py-2 ${itemClass}`}>
                <div className="flex items-center gap-2">
                  {item.status === 'processing' ? (
                    <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" style={{ color: '#4FC3F7', fontSize: 14 }} />
                  ) : item.status === 'failed' ? (
                    <FontAwesomeIcon icon={faExclamationTriangle} aria-hidden="true" style={{ color: '#C62828', fontSize: 14 }} />
                  ) : (
                    <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" style={{ color: '#E7BA61', fontSize: 14 }} />
                  )}
                  <p className={`text-[13px] ${detailTextClass}`}>{item.label}</p>
                </div>
                {item.status === 'failed' && item.lastError ? (
                  <p className="mt-1 text-[12px] text-[#C62828]">{item.lastError}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {syncedNow.length > 0 ? (
        <div className="progressive-card grid gap-2" style={{ ['--card-delay' as string]: '80ms' }}>
          <h3 className={`text-[14px] font-semibold ${textClass}`}>Sincronizados recién</h3>
          <div className="grid gap-2">
            {syncedNow.map((label, index) => (
              <div
                key={`${label}-${index}`}
                className={`rounded-xl border px-3 py-2 ${itemClass}`}
              >
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" style={{ color: '#32A852', fontSize: 14 }} />
                  <p className={`text-[13px] ${detailTextClass}`}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
