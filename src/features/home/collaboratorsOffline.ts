import { v4 as uuidv4 } from 'uuid'
import {
  listSpaceCollaborators,
  type CollaboratorPreview,
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

function todayIso(): string {
  return nowIso().slice(0, 10)
}

function toLocalRecord(remote: SpaceCollaborator): SpaceCollaboratorRecord {
  const now = nowIso()
  return {
    id: `remote-${remote.id}`,
    space_id: remote.comedor,
    remote_id: remote.id,
    ciudadano_id: remote.ciudadano_id,
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
    created_at: remote.fecha_creado || now,
    updated_at: remote.fecha_modificado || now,
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

function sortRows(rows: SpaceCollaboratorRecord[]): SpaceCollaboratorRecord[] {
  return rows.sort((a, b) => {
    if (a.activo !== b.activo) {
      return a.activo ? -1 : 1
    }
    return `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)
  })
}

export async function listLocalSpaceCollaborators(
  spaceId: string | number,
): Promise<SpaceCollaboratorRecord[]> {
  const parsedSpaceId = Number(spaceId)
  const rows = await db.space_collaborators
    .where('space_id')
    .equals(parsedSpaceId)
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

  return sortRows([...withoutRemoteId, ...Array.from(uniqueByRemoteId.values())])
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
        fecha_baja: localRow.fecha_baja || todayIso(),
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
  preview: CollaboratorPreview,
): Promise<SpaceCollaboratorRecord> {
  const parsedSpaceId = Number(spaceId)
  const timestamp = nowIso()
  const localId = `local-${uuidv4()}`
  const record: SpaceCollaboratorRecord = {
    id: localId,
    space_id: parsedSpaceId,
    remote_id: null,
    ciudadano_id: payload.ciudadano_id || preview.ciudadano_id,
    nombre: preview.nombre,
    apellido: preview.apellido,
    dni: preview.dni,
    prefijo_cuil: preview.prefijo_cuil,
    cuil_cuit: preview.cuil_cuit,
    sufijo_cuil: preview.sufijo_cuil,
    sexo: preview.sexo,
    genero: payload.genero,
    fecha_nacimiento: preview.fecha_nacimiento,
    edad: preview.edad,
    codigo_telefono: payload.codigo_telefono,
    numero_telefono: payload.numero_telefono,
    fecha_alta: payload.fecha_alta,
    fecha_baja: payload.fecha_baja || null,
    actividades: [],
    activo: !payload.fecha_baja,
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
    ciudadano_id: payload.ciudadano_id || collaborator.ciudadano_id || null,
    genero: payload.genero,
    codigo_telefono: payload.codigo_telefono,
    numero_telefono: payload.numero_telefono,
    fecha_alta: payload.fecha_alta,
    fecha_baja: payload.fecha_baja || null,
    activo: !payload.fecha_baja,
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
    await db.space_collaborators.update(collaborator.id, {
      activo: false,
      fecha_baja: collaborator.fecha_baja || todayIso(),
      pending_action: null,
      sync_status: 'synced',
      updated_at: nowIso(),
    })
    return
  }

  await db.space_collaborators.update(collaborator.id, {
    activo: false,
    fecha_baja: collaborator.fecha_baja || todayIso(),
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
