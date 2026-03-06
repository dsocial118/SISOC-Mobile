import axios from 'axios'
import { createRemoteNote, type CreateNotePayload } from '../api/notesApi'
import { isTransientNetworkError, OfflineError } from '../api/http'
import {
  createSpaceCollaborator,
  deleteSpaceCollaborator,
  listSpaceCollaborators,
  type SpaceCollaborator,
  updateSpaceCollaborator,
} from '../api/collaboratorsApi'
import { db, type OutboxRecord } from '../db/database'
import type {
  CreateCollaboratorOutboxPayload,
  DeleteCollaboratorOutboxPayload,
  UpdateCollaboratorOutboxPayload,
} from '../features/home/collaboratorsOffline'

const MAX_RETRIES = 5
const SYNC_INTERVAL_MS = 30000
let running = false
let started = false

function nextBackoffMs(attempts: number): number {
  const base = 2000
  return Math.min(base * 2 ** Math.max(0, attempts - 1), 60000)
}

function normalizeText(value: string | undefined | null): string {
  return String(value || '').trim().toLowerCase()
}

function normalizeDni(value: string | undefined | null): string {
  return String(value || '').replace(/\D/g, '')
}

function sameCollaboratorData(
  remote: SpaceCollaborator,
  expected: Partial<{
    nombre: string
    apellido: string
    dni: string
    telefono: string
    email: string
    rol_funcion: string
  }>,
): boolean {
  if (expected.nombre !== undefined && normalizeText(remote.nombre) !== normalizeText(expected.nombre)) {
    return false
  }
  if (expected.apellido !== undefined && normalizeText(remote.apellido) !== normalizeText(expected.apellido)) {
    return false
  }
  if (expected.dni !== undefined && normalizeDni(remote.dni) !== normalizeDni(expected.dni)) {
    return false
  }
  if (expected.telefono !== undefined && normalizeText(remote.telefono) !== normalizeText(expected.telefono)) {
    return false
  }
  if (expected.email !== undefined && normalizeText(remote.email) !== normalizeText(expected.email)) {
    return false
  }
  if (
    expected.rol_funcion !== undefined &&
    normalizeText(remote.rol_funcion) !== normalizeText(expected.rol_funcion)
  ) {
    return false
  }
  return true
}

async function tryResolveCollaboratorCreate(item: OutboxRecord & { id: number }): Promise<boolean> {
  const payload = item.payload as unknown as CreateCollaboratorOutboxPayload
  const local = await db.space_collaborators.get(payload.local_id)
  if (!local) {
    await db.outbox.delete(item.id)
    return true
  }

  const remoteRows = await listSpaceCollaborators(payload.space_id)
  const remote = remoteRows.find((row) => normalizeDni(row.dni) === normalizeDni(payload.data.dni))
  if (!remote) {
    return false
  }

  await db.space_collaborators.update(local.id, {
    remote_id: remote.id,
    nombre: remote.nombre,
    apellido: remote.apellido,
    dni: remote.dni,
    telefono: remote.telefono,
    email: remote.email,
    rol_funcion: remote.rol_funcion,
    activo: remote.activo,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    updated_at: remote.fecha_actualizacion || new Date().toISOString(),
  })
  await db.outbox.delete(item.id)
  return true
}

async function tryResolveCollaboratorUpdate(item: OutboxRecord & { id: number }): Promise<boolean> {
  const payload = item.payload as unknown as UpdateCollaboratorOutboxPayload
  const local = await db.space_collaborators.get(payload.local_id)
  if (!local) {
    await db.outbox.delete(item.id)
    return true
  }

  const remoteRows = await listSpaceCollaborators(payload.space_id)
  const remote = local.remote_id
    ? remoteRows.find((row) => row.id === local.remote_id)
    : remoteRows.find((row) => normalizeDni(row.dni) === normalizeDni(local.dni))

  if (!remote) {
    return false
  }
  if (!sameCollaboratorData(remote, payload.data)) {
    return false
  }

  await db.space_collaborators.update(local.id, {
    remote_id: remote.id,
    nombre: remote.nombre,
    apellido: remote.apellido,
    dni: remote.dni,
    telefono: remote.telefono,
    email: remote.email,
    rol_funcion: remote.rol_funcion,
    activo: remote.activo,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    updated_at: remote.fecha_actualizacion || new Date().toISOString(),
  })
  await db.outbox.delete(item.id)
  return true
}

async function tryResolveCollaboratorDelete(item: OutboxRecord & { id: number }): Promise<boolean> {
  const payload = item.payload as unknown as DeleteCollaboratorOutboxPayload
  const local = await db.space_collaborators.get(payload.local_id)
  if (!local) {
    await db.outbox.delete(item.id)
    return true
  }

  const remoteRows = await listSpaceCollaborators(payload.space_id)
  const stillExists = local.remote_id
    ? remoteRows.some((row) => row.id === local.remote_id)
    : remoteRows.some((row) => normalizeDni(row.dni) === normalizeDni(local.dni))

  if (stillExists) {
    return false
  }

  await db.space_collaborators.delete(local.id)
  await db.outbox.delete(item.id)
  return true
}

async function tryResolveCollaboratorFromRemote(item: OutboxRecord & { id: number }): Promise<boolean> {
  if (item.type === 'CREATE_COLLABORATOR') {
    return tryResolveCollaboratorCreate(item)
  }
  if (item.type === 'UPDATE_COLLABORATOR') {
    return tryResolveCollaboratorUpdate(item)
  }
  if (item.type === 'DELETE_COLLABORATOR') {
    return tryResolveCollaboratorDelete(item)
  }
  return false
}

async function processOutboxItem(item: OutboxRecord): Promise<boolean> {
  if (!item.id) {
    return true
  }

  const itemWithId = item as OutboxRecord & { id: number }

  await db.outbox.update(itemWithId.id, {
    status: 'processing',
    attempts: item.attempts + 1,
  })

  try {
    if (item.type === 'CREATE_NOTE') {
      await createRemoteNote({
        payload: item.payload as unknown as CreateNotePayload,
        client_uuid: item.client_uuid,
      })

      const noteId = typeof item.payload.id === 'string' ? item.payload.id : null
      if (noteId) {
        await db.notes.update(noteId, { synced: true })
      }
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'CREATE_COLLABORATOR') {
      const payload = item.payload as unknown as CreateCollaboratorOutboxPayload
      const localId = payload.local_id
      const local = await db.space_collaborators.get(localId)
      if (!local) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (local.remote_id) {
        await db.space_collaborators.update(local.id, {
          sync_status: 'synced',
          pending_action: null,
          last_error: null,
        })
        await db.outbox.delete(itemWithId.id)
        return true
      }

      const created = await createSpaceCollaborator(payload.space_id, payload.data)
      await db.space_collaborators.update(local.id, {
        remote_id: created.id,
        nombre: created.nombre,
        apellido: created.apellido,
        dni: created.dni,
        telefono: created.telefono,
        email: created.email,
        rol_funcion: created.rol_funcion,
        activo: created.activo,
        sync_status: 'synced',
        pending_action: null,
        last_error: null,
        updated_at: created.fecha_actualizacion || new Date().toISOString(),
      })
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'UPDATE_COLLABORATOR') {
      const payload = item.payload as unknown as UpdateCollaboratorOutboxPayload
      const local = await db.space_collaborators.get(payload.local_id)
      if (!local) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (!local.remote_id) {
        // Espera a que se sincronice CREATE_COLLABORATOR.
        await db.outbox.update(itemWithId.id, {
          status: 'pending',
          attempts: item.attempts,
          next_retry_at: new Date(Date.now() + nextBackoffMs(1)).toISOString(),
        })
        return true
      }

      const updated = await updateSpaceCollaborator(payload.space_id, local.remote_id, payload.data)
      await db.space_collaborators.update(local.id, {
        nombre: updated.nombre,
        apellido: updated.apellido,
        dni: updated.dni,
        telefono: updated.telefono,
        email: updated.email,
        rol_funcion: updated.rol_funcion,
        activo: updated.activo,
        sync_status: 'synced',
        pending_action: null,
        last_error: null,
        updated_at: updated.fecha_actualizacion || new Date().toISOString(),
      })
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'DELETE_COLLABORATOR') {
      const payload = item.payload as unknown as DeleteCollaboratorOutboxPayload
      const local = await db.space_collaborators.get(payload.local_id)
      if (!local) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (!local.remote_id) {
        await db.space_collaborators.delete(local.id)
        await db.outbox.delete(itemWithId.id)
        return true
      }

      await deleteSpaceCollaborator(payload.space_id, local.remote_id)
      await db.space_collaborators.delete(local.id)
      await db.outbox.delete(itemWithId.id)
      return true
    }

    await db.outbox.delete(itemWithId.id)
    return true
  } catch (error) {
    const localId = String(item.payload?.local_id || '')
    const collaboratorAction =
      item.type === 'CREATE_COLLABORATOR' ||
      item.type === 'UPDATE_COLLABORATOR' ||
      item.type === 'DELETE_COLLABORATOR'

    if (
      collaboratorAction &&
      (isTransientNetworkError(error) ||
        (axios.isAxiosError(error) &&
          (error.response?.status === 400 || error.response?.status === 409)))
    ) {
      try {
        const resolved = await tryResolveCollaboratorFromRemote(itemWithId)
        if (resolved) {
          return true
        }
      } catch {
        // Continua manejo normal de error.
      }
    }

    if (localId) {
      await db.space_collaborators.update(localId, {
        sync_status: 'failed',
        last_error: error instanceof Error ? error.message : 'Error de sincronización',
      })
    }

    if (error instanceof OfflineError) {
      await db.outbox.update(itemWithId.id, {
        status: 'pending',
        attempts: item.attempts,
        next_retry_at: null,
      })
      return false
    }

    if (isTransientNetworkError(error)) {
      await db.outbox.update(itemWithId.id, {
        status: 'pending',
        attempts: item.attempts,
        next_retry_at: new Date(Date.now() + nextBackoffMs(item.attempts + 1)).toISOString(),
        last_error: error instanceof Error ? error.message : 'Fallo transitorio de red',
      })
      return false
    }

    const attempts = item.attempts + 1
    if (attempts >= MAX_RETRIES) {
      await db.outbox.update(itemWithId.id, {
        status: 'failed',
        next_retry_at: null,
        last_error: error instanceof Error ? error.message : 'Error desconocido durante sync',
      })
      return true
    }

    await db.outbox.update(itemWithId.id, {
      status: 'failed',
      next_retry_at: new Date(Date.now() + nextBackoffMs(attempts)).toISOString(),
      last_error: error instanceof Error ? error.message : 'Error de sincronizacion',
    })
    return true
  }
}

export async function syncNow(): Promise<void> {
  if (running) {
    return
  }

  running = true
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return
    }

    const nowIso = new Date().toISOString()
    const items = await db.outbox.orderBy('created_at').toArray()
    for (const item of items) {
      if (item.next_retry_at && item.next_retry_at > nowIso) {
        continue
      }
      const shouldContinue = await processOutboxItem(item)
      if (!shouldContinue) {
        break
      }
    }
  } finally {
    running = false
  }
}

export function startSyncEngine(): void {
  if (typeof window === 'undefined' || started) {
    return
  }

  started = true

  window.addEventListener('online', () => {
    void syncNow()
  })

  window.setInterval(() => {
    void syncNow()
  }, SYNC_INTERVAL_MS)

  void syncNow()
}
