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
import {
  createRendicionOnServer,
  deleteRendicionFileOnServer,
  deleteRendicionOnServer,
  getLocalRendicion,
  getLocalRendicionFile,
  getRendicionPendingUploadsCount,
  markRendicionError,
  markRendicionFileError,
  presentRendicionOnServer,
  removeLocalRendicion,
  removeLocalRendicionFile,
  syncDeleteRendicionFileFromServer,
  syncPresentRendicionFromServer,
  syncRemoteRendicionDetailToLocal,
  uploadFileToServer,
  type CreateRendicionOutboxPayload,
  type DeleteRendicionFileOutboxPayload,
  type DeleteRendicionOutboxPayload,
  type PresentRendicionOutboxPayload,
  type UploadRendicionFileOutboxPayload,
} from '../features/home/rendicionOffline'

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
    dni: string
    genero: string
    codigo_telefono: string
    numero_telefono: string
    fecha_alta: string
    fecha_baja: string | null
  }>,
): boolean {
  if (expected.dni !== undefined && normalizeDni(remote.dni) !== normalizeDni(expected.dni)) {
    return false
  }
  if (expected.genero !== undefined && normalizeText(remote.genero) !== normalizeText(expected.genero)) {
    return false
  }
  if (
    expected.codigo_telefono !== undefined
    && normalizeText(remote.codigo_telefono) !== normalizeText(expected.codigo_telefono)
  ) {
    return false
  }
  if (
    expected.numero_telefono !== undefined
    && normalizeText(remote.numero_telefono) !== normalizeText(expected.numero_telefono)
  ) {
    return false
  }
  if (expected.fecha_alta !== undefined && remote.fecha_alta !== expected.fecha_alta) {
    return false
  }
  if (expected.fecha_baja !== undefined && (remote.fecha_baja || null) !== (expected.fecha_baja || null)) {
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
  const remote = remoteRows.find(
    (row) =>
      normalizeDni(row.dni) === normalizeDni(payload.data.dni)
      && row.fecha_alta === payload.data.fecha_alta,
  )
  if (!remote) {
    return false
  }

  await db.space_collaborators.update(local.id, {
    ciudadano_id: remote.ciudadano_id,
    remote_id: remote.id,
    nombre: remote.nombre,
    apellido: remote.apellido,
    dni: remote.dni,
    prefijo_cuil: remote.prefijo_cuil,
    cuil_cuit: remote.cuil_cuit,
    sufijo_cuil: remote.sufijo_cuil,
    sexo: remote.sexo,
    genero: remote.genero,
    fecha_nacimiento: remote.fecha_nacimiento,
    edad: remote.edad,
    codigo_telefono: remote.codigo_telefono || '',
    numero_telefono: remote.numero_telefono || '',
    fecha_alta: remote.fecha_alta,
    fecha_baja: remote.fecha_baja,
    actividades: remote.actividades,
    activo: remote.activo,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    updated_at: remote.fecha_modificado || new Date().toISOString(),
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
    ciudadano_id: remote.ciudadano_id,
    remote_id: remote.id,
    nombre: remote.nombre,
    apellido: remote.apellido,
    dni: remote.dni,
    prefijo_cuil: remote.prefijo_cuil,
    cuil_cuit: remote.cuil_cuit,
    sufijo_cuil: remote.sufijo_cuil,
    sexo: remote.sexo,
    genero: remote.genero,
    fecha_nacimiento: remote.fecha_nacimiento,
    edad: remote.edad,
    codigo_telefono: remote.codigo_telefono || '',
    numero_telefono: remote.numero_telefono || '',
    fecha_alta: remote.fecha_alta,
    fecha_baja: remote.fecha_baja,
    actividades: remote.actividades,
    activo: remote.activo,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    updated_at: remote.fecha_modificado || new Date().toISOString(),
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
  const remote = local.remote_id
    ? remoteRows.find((row) => row.id === local.remote_id)
    : remoteRows.find((row) => normalizeDni(row.dni) === normalizeDni(local.dni) && row.fecha_alta === local.fecha_alta)

  if (!remote || remote.activo) {
    return false
  }

  await db.space_collaborators.update(local.id, {
    ciudadano_id: remote.ciudadano_id,
    remote_id: remote.id,
    nombre: remote.nombre,
    apellido: remote.apellido,
    dni: remote.dni,
    prefijo_cuil: remote.prefijo_cuil,
    cuil_cuit: remote.cuil_cuit,
    sufijo_cuil: remote.sufijo_cuil,
    sexo: remote.sexo,
    genero: remote.genero,
    fecha_nacimiento: remote.fecha_nacimiento,
    edad: remote.edad,
    codigo_telefono: remote.codigo_telefono || '',
    numero_telefono: remote.numero_telefono || '',
    fecha_alta: remote.fecha_alta,
    fecha_baja: remote.fecha_baja,
    actividades: remote.actividades,
    activo: false,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    updated_at: remote.fecha_modificado || new Date().toISOString(),
  })
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
        ciudadano_id: created.ciudadano_id,
        remote_id: created.id,
        nombre: created.nombre,
        apellido: created.apellido,
        dni: created.dni,
        prefijo_cuil: created.prefijo_cuil,
        cuil_cuit: created.cuil_cuit,
        sufijo_cuil: created.sufijo_cuil,
        sexo: created.sexo,
        genero: created.genero,
        fecha_nacimiento: created.fecha_nacimiento,
        edad: created.edad,
        codigo_telefono: created.codigo_telefono || '',
        numero_telefono: created.numero_telefono || '',
        fecha_alta: created.fecha_alta,
        fecha_baja: created.fecha_baja,
        actividades: created.actividades,
        activo: created.activo,
        sync_status: 'synced',
        pending_action: null,
        last_error: null,
        updated_at: created.fecha_modificado || new Date().toISOString(),
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
        ciudadano_id: updated.ciudadano_id,
        nombre: updated.nombre,
        apellido: updated.apellido,
        dni: updated.dni,
        prefijo_cuil: updated.prefijo_cuil,
        cuil_cuit: updated.cuil_cuit,
        sufijo_cuil: updated.sufijo_cuil,
        sexo: updated.sexo,
        genero: updated.genero,
        fecha_nacimiento: updated.fecha_nacimiento,
        edad: updated.edad,
        codigo_telefono: updated.codigo_telefono || '',
        numero_telefono: updated.numero_telefono || '',
        fecha_alta: updated.fecha_alta,
        fecha_baja: updated.fecha_baja,
        actividades: updated.actividades,
        activo: updated.activo,
        sync_status: 'synced',
        pending_action: null,
        last_error: null,
        updated_at: updated.fecha_modificado || new Date().toISOString(),
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
        await db.space_collaborators.update(local.id, {
          activo: false,
          fecha_baja: local.fecha_baja || new Date().toISOString().slice(0, 10),
          sync_status: 'synced',
          pending_action: null,
          last_error: null,
        })
        await db.outbox.delete(itemWithId.id)
        return true
      }

      await deleteSpaceCollaborator(payload.space_id, local.remote_id)
      const remoteRows = await listSpaceCollaborators(payload.space_id)
      const remote = remoteRows.find((row) => row.id === local.remote_id)
      await db.space_collaborators.update(local.id, {
        ciudadano_id: remote?.ciudadano_id || local.ciudadano_id || null,
        nombre: remote?.nombre || local.nombre,
        apellido: remote?.apellido || local.apellido,
        dni: remote?.dni || local.dni,
        prefijo_cuil: remote?.prefijo_cuil || local.prefijo_cuil || null,
        cuil_cuit: remote?.cuil_cuit || local.cuil_cuit || null,
        sufijo_cuil: remote?.sufijo_cuil || local.sufijo_cuil || null,
        sexo: remote?.sexo || local.sexo || null,
        genero: remote?.genero || local.genero,
        fecha_nacimiento: remote?.fecha_nacimiento || local.fecha_nacimiento || null,
        edad: remote?.edad ?? local.edad ?? null,
        codigo_telefono: remote?.codigo_telefono || local.codigo_telefono,
        numero_telefono: remote?.numero_telefono || local.numero_telefono,
        fecha_alta: remote?.fecha_alta || local.fecha_alta,
        fecha_baja: remote?.fecha_baja || local.fecha_baja || new Date().toISOString().slice(0, 10),
        actividades: remote?.actividades || local.actividades,
        activo: false,
        sync_status: 'synced',
        pending_action: null,
        last_error: null,
        updated_at: remote?.fecha_modificado || new Date().toISOString(),
      })
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'CREATE_RENDICION') {
      const payload = item.payload as unknown as CreateRendicionOutboxPayload
      const local = await getLocalRendicion(payload.local_id)
      if (!local) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (local.remote_id) {
        await db.rendiciones.update(local.id, {
          sync_status: 'synced',
          pending_action: null,
          last_error: null,
        })
        await db.outbox.delete(itemWithId.id)
        return true
      }

      const created = await createRendicionOnServer(payload.space_id, payload.data)
      await syncRemoteRendicionDetailToLocal(payload.space_id, created, local.id)
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'UPLOAD_RENDICION_FILE') {
      const payload = item.payload as unknown as UploadRendicionFileOutboxPayload
      const local = await getLocalRendicion(payload.local_rendicion_id)
      const localFile = await getLocalRendicionFile(payload.local_file_id)
      if (!local || !localFile) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (localFile.pending_action !== 'upload') {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (!local.remote_id) {
        await db.outbox.update(itemWithId.id, {
          status: 'pending',
          attempts: item.attempts,
          next_retry_at: new Date(Date.now() + nextBackoffMs(1)).toISOString(),
        })
        return true
      }

      const detail = await uploadFileToServer({
        spaceId: payload.space_id,
        remoteRendicionId: local.remote_id,
        localFile,
      })
      await syncRemoteRendicionDetailToLocal(payload.space_id, detail, local.id)
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'DELETE_RENDICION_FILE') {
      const payload = item.payload as unknown as DeleteRendicionFileOutboxPayload
      const local = await getLocalRendicion(payload.local_rendicion_id)
      const localFile = await getLocalRendicionFile(payload.local_file_id)
      if (!local || !localFile) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (!local.remote_id || !localFile.remote_id) {
        await removeLocalRendicionFile(localFile.id)
        await db.outbox.delete(itemWithId.id)
        return true
      }

      await deleteRendicionFileOnServer({
        spaceId: payload.space_id,
        remoteRendicionId: local.remote_id,
        remoteFileId: localFile.remote_id,
      })
      await syncDeleteRendicionFileFromServer(local.id, payload.space_id, local.remote_id)
      await removeLocalRendicionFile(localFile.id)
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'PRESENT_RENDICION') {
      const payload = item.payload as unknown as PresentRendicionOutboxPayload
      const local = await getLocalRendicion(payload.local_rendicion_id)
      if (!local) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (!local.remote_id) {
        await db.outbox.update(itemWithId.id, {
          status: 'pending',
          attempts: item.attempts,
          next_retry_at: new Date(Date.now() + nextBackoffMs(1)).toISOString(),
        })
        return true
      }

      const pendingUploads = await getRendicionPendingUploadsCount(local.id)
      if (pendingUploads > 0) {
        await db.outbox.update(itemWithId.id, {
          status: 'pending',
          attempts: item.attempts,
          next_retry_at: new Date(Date.now() + nextBackoffMs(1)).toISOString(),
        })
        return true
      }

      await presentRendicionOnServer(payload.space_id, local.remote_id)
      await syncPresentRendicionFromServer(local.id, payload.space_id, local.remote_id)
      await db.outbox.delete(itemWithId.id)
      return true
    }

    if (item.type === 'DELETE_RENDICION') {
      const payload = item.payload as unknown as DeleteRendicionOutboxPayload
      const local = await getLocalRendicion(payload.local_rendicion_id)
      if (!local) {
        await db.outbox.delete(itemWithId.id)
        return true
      }
      if (!local.remote_id) {
        await removeLocalRendicion(local.id)
        await db.outbox.delete(itemWithId.id)
        return true
      }
      await deleteRendicionOnServer(payload.space_id, local.remote_id)
      await removeLocalRendicion(local.id)
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

    const localRendicionId = String(item.payload?.local_rendicion_id || item.payload?.local_id || '')
    const localRendicionFileId = String(item.payload?.local_file_id || '')
    const rendicionAction =
      item.type === 'CREATE_RENDICION'
      || item.type === 'UPLOAD_RENDICION_FILE'
      || item.type === 'DELETE_RENDICION_FILE'
      || item.type === 'PRESENT_RENDICION'
      || item.type === 'DELETE_RENDICION'

    if (rendicionAction && localRendicionId) {
      await markRendicionError(
        localRendicionId,
        error instanceof Error ? error.message : 'Error de sincronización',
      )
    }
    if (rendicionAction && localRendicionFileId) {
      await markRendicionFileError(
        localRendicionFileId,
        error instanceof Error ? error.message : 'Error de sincronización',
      )
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
