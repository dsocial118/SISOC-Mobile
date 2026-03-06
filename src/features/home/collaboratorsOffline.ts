import { v4 as uuidv4 } from 'uuid'
import {
  listSpaceCollaborators,
  type SpaceCollaborator,
  type SpaceCollaboratorPayload,
} from '../../api/collaboratorsApi'
import { db, type OutboxRecord, type SpaceCollaboratorRecord } from '../../db/database'
import { enqueueOutbox } from '../../sync/outbox'

export interface CreateCollaboratorOutboxPayload {
  local_id: string
  space_id: number
  data: SpaceCollaboratorPayload
}

export interface UpdateCollaboratorOutboxPayload {
  local_id: string
  space_id: number
  data: SpaceCollaboratorPayload
}

export interface DeleteCollaboratorOutboxPayload {
  local_id: string
  space_id: number
}

function outboxPayload<T extends object>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>
}

function nowIso(): string {
  return new Date().toISOString()
}

function toLocalRecord(remote: SpaceCollaborator): SpaceCollaboratorRecord {
  const now = nowIso()
  return {
    id: `remote-${remote.id}`,
    space_id: remote.comedor,
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
    created_at: remote.fecha_creacion || now,
    updated_at: remote.fecha_actualizacion || now,
  }
}

async function findOutboxForLocalId(
  type: OutboxRecord['type'],
  localId: string,
): Promise<OutboxRecord | undefined> {
  return db.outbox
    .where('type')
    .equals(type)
    .filter((row) => String(row.payload.local_id || '') === localId)
    .first()
}

async function removeOutboxForLocalId(localId: string): Promise<void> {
  const matches = await db.outbox
    .filter((row) => String(row.payload.local_id || '') === localId)
    .toArray()
  await Promise.all(matches.map((row) => (row.id ? db.outbox.delete(row.id) : Promise.resolve())))
}

export async function listLocalSpaceCollaborators(
  spaceId: string | number,
): Promise<SpaceCollaboratorRecord[]> {
  const parsedSpaceId = Number(spaceId)
  const rows = await db.space_collaborators
    .where('space_id')
    .equals(parsedSpaceId)
    .filter((row) => row.activo && row.pending_action !== 'delete')
    .toArray()
  const uniqueByRemoteId = new Map<number, SpaceCollaboratorRecord>()
  const withoutRemoteId: SpaceCollaboratorRecord[] = []

  for (const row of rows) {
    if (!row.remote_id) {
      withoutRemoteId.push(row)
      continue
    }

    const existing = uniqueByRemoteId.get(row.remote_id)
    if (!existing) {
      uniqueByRemoteId.set(row.remote_id, row)
      continue
    }

    const rowHasPending = Boolean(row.pending_action)
    const existingHasPending = Boolean(existing.pending_action)
    if (rowHasPending && !existingHasPending) {
      uniqueByRemoteId.set(row.remote_id, row)
      continue
    }
    if (rowHasPending === existingHasPending) {
      const rowUpdatedAt = Date.parse(row.updated_at || '')
      const existingUpdatedAt = Date.parse(existing.updated_at || '')
      if (!Number.isNaN(rowUpdatedAt) && (Number.isNaN(existingUpdatedAt) || rowUpdatedAt > existingUpdatedAt)) {
        uniqueByRemoteId.set(row.remote_id, row)
      }
    }
  }

  return [...withoutRemoteId, ...Array.from(uniqueByRemoteId.values())].sort((a, b) =>
    `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
  )
}

export async function mergeRemoteCollaborators(spaceId: string | number): Promise<void> {
  const parsedSpaceId = Number(spaceId)
  const remoteRows = await listSpaceCollaborators(parsedSpaceId)
  const remoteById = new Map(remoteRows.map((row) => [row.id, row]))

  const locals = await db.space_collaborators.where('space_id').equals(parsedSpaceId).toArray()
  for (const localRow of locals) {
    if (localRow.pending_action && localRow.pending_action !== null) {
      if (localRow.remote_id) {
        remoteById.delete(localRow.remote_id)
      }
      continue
    }
    if (!localRow.remote_id) {
      continue
    }
    const remote = remoteById.get(localRow.remote_id)
    if (!remote) {
      await db.space_collaborators.update(localRow.id, {
        activo: false,
        sync_status: 'synced',
        pending_action: null,
        updated_at: nowIso(),
      })
      continue
    }
    const mapped = toLocalRecord(remote)
    await db.space_collaborators.put({
      ...mapped,
      id: localRow.id,
      created_at: localRow.created_at || mapped.created_at,
    })
    remoteById.delete(remote.id)
  }

  for (const remote of remoteById.values()) {
    await db.space_collaborators.put(toLocalRecord(remote))
  }
}

export async function createCollaboratorOffline(
  spaceId: string | number,
  payload: SpaceCollaboratorPayload,
): Promise<SpaceCollaboratorRecord> {
  const parsedSpaceId = Number(spaceId)
  const timestamp = nowIso()
  const localId = `local-${uuidv4()}`
  const record: SpaceCollaboratorRecord = {
    id: localId,
    space_id: parsedSpaceId,
    remote_id: null,
    nombre: payload.nombre,
    apellido: payload.apellido,
    dni: payload.dni,
    telefono: payload.telefono,
    email: payload.email,
    rol_funcion: payload.rol_funcion,
    activo: true,
    sync_status: 'pending',
    pending_action: 'create',
    last_error: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.space_collaborators.put(record)
  await enqueueOutbox({
    type: 'CREATE_COLLABORATOR',
    client_uuid: uuidv4(),
    payload: outboxPayload<CreateCollaboratorOutboxPayload>({
      local_id: localId,
      space_id: parsedSpaceId,
      data: payload,
    }),
  })
  return record
}

export async function updateCollaboratorOffline(
  collaborator: SpaceCollaboratorRecord,
  payload: SpaceCollaboratorPayload,
): Promise<void> {
  const timestamp = nowIso()
  await db.space_collaborators.update(collaborator.id, {
    ...payload,
    updated_at: timestamp,
    sync_status: 'pending',
    pending_action: collaborator.remote_id ? 'update' : collaborator.pending_action || 'create',
    last_error: null,
  })

  if (!collaborator.remote_id) {
    const pendingCreate = await findOutboxForLocalId('CREATE_COLLABORATOR', collaborator.id)
    if (pendingCreate?.id) {
      await db.outbox.update(pendingCreate.id, {
        payload: outboxPayload<CreateCollaboratorOutboxPayload>({
          local_id: collaborator.id,
          space_id: collaborator.space_id,
          data: payload,
        }),
        status: 'pending',
        next_retry_at: null,
        last_error: null,
      })
    }
    return
  }

  const existingUpdate = await findOutboxForLocalId('UPDATE_COLLABORATOR', collaborator.id)
  if (existingUpdate?.id) {
    await db.outbox.update(existingUpdate.id, {
      payload: outboxPayload<UpdateCollaboratorOutboxPayload>({
        local_id: collaborator.id,
        space_id: collaborator.space_id,
        data: payload,
      }),
      status: 'pending',
      next_retry_at: null,
      last_error: null,
    })
    return
  }

  await enqueueOutbox({
    type: 'UPDATE_COLLABORATOR',
    client_uuid: uuidv4(),
    payload: outboxPayload<UpdateCollaboratorOutboxPayload>({
      local_id: collaborator.id,
      space_id: collaborator.space_id,
      data: payload,
    }),
  })
}

export async function deleteCollaboratorOffline(
  collaborator: SpaceCollaboratorRecord,
): Promise<void> {
  if (!collaborator.remote_id) {
    await removeOutboxForLocalId(collaborator.id)
    await db.space_collaborators.delete(collaborator.id)
    return
  }

  await db.space_collaborators.update(collaborator.id, {
    activo: false,
    sync_status: 'pending',
    pending_action: 'delete',
    updated_at: nowIso(),
    last_error: null,
  })

  const existingDelete = await findOutboxForLocalId('DELETE_COLLABORATOR', collaborator.id)
  if (existingDelete?.id) {
    await db.outbox.update(existingDelete.id, {
      status: 'pending',
      next_retry_at: null,
      last_error: null,
    })
    return
  }

  await enqueueOutbox({
    type: 'DELETE_COLLABORATOR',
    client_uuid: uuidv4(),
    payload: outboxPayload<DeleteCollaboratorOutboxPayload>({
      local_id: collaborator.id,
      space_id: collaborator.space_id,
    }),
  })
}
