import { v4 as uuidv4 } from 'uuid'
import {
  createSpaceRendicion,
  deleteRendicionFile,
  deleteSpaceRendicion,
  getSpaceRendicionDetail,
  listSpaceRendiciones,
  presentRendicion,
  uploadRendicionFile,
  type CreateRendicionPayload,
  type RendicionDetail,
  type RendicionDocumentCategory,
  type RendicionFileItem,
  type RendicionItem,
} from '../../api/rendicionApi'
import {
  db,
  type LocalRendicionFileRecord,
  type LocalRendicionRecord,
  type OutboxRecord,
} from '../../db/database'
import { enqueueOutbox } from '../../sync/outbox'

type DocumentCategoryConfig = Omit<RendicionDocumentCategory, 'archivos'>

const DOCUMENT_CATEGORIES: DocumentCategoryConfig[] = [
  {
    codigo: 'formulario_ii',
    label: 'Formulario II',
    required: true,
    multiple: false,
    order: 1,
  },
  {
    codigo: 'formulario_iii',
    label: 'Formulario III',
    required: true,
    multiple: false,
    order: 2,
  },
  {
    codigo: 'formulario_iv',
    label: 'Formulario IV',
    required: false,
    multiple: false,
    order: 3,
  },
  {
    codigo: 'formulario_v',
    label: 'Formulario V',
    required: true,
    multiple: false,
    order: 4,
  },
  {
    codigo: 'formulario_vi',
    label: 'Formulario VI',
    required: false,
    multiple: false,
    order: 5,
  },
  {
    codigo: 'extracto_bancario',
    label: 'Extracto Bancario',
    required: true,
    multiple: false,
    order: 6,
  },
  {
    codigo: 'comprobantes',
    label: 'Comprobante/s',
    required: true,
    multiple: true,
    order: 7,
  },
  {
    codigo: 'planilla_seguros',
    label: 'Planilla de Seguros',
    required: false,
    multiple: false,
    order: 8,
  },
  {
    codigo: 'otros',
    label: 'Documentación Extra',
    required: false,
    multiple: true,
    order: 9,
  },
]

const RENDICION_STATUS_LABELS: Record<string, string> = {
  elaboracion: 'Presentación en elaboración',
  revision: 'Presentación en revisión',
  subsanar: 'Presentación a subsanar',
  finalizada: 'Presentación finalizada',
}

const FILE_STATUS_LABELS: Record<string, string> = {
  presentado: 'Presentado',
  subsanar: 'A Subsanar',
  validado: 'Validado',
}

export interface CreateRendicionOutboxPayload {
  local_id: string
  space_id: number
  data: CreateRendicionPayload
}

export interface UploadRendicionFileOutboxPayload {
  local_rendicion_id: string
  local_file_id: string
  space_id: number
  categoria: string
  name?: string
}

export interface DeleteRendicionFileOutboxPayload {
  local_rendicion_id: string
  local_file_id: string
  space_id: number
}

export interface PresentRendicionOutboxPayload {
  local_rendicion_id: string
  space_id: number
}

export interface DeleteRendicionOutboxPayload {
  local_rendicion_id: string
  space_id: number
}

function outboxPayload<T extends object>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseDateParts(value: string): { month: number; year: number } {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return {
      month: 0,
      year: 0,
    }
  }
  return {
    month: parsed.getUTCMonth() + 1,
    year: parsed.getUTCFullYear(),
  }
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function formatDate(value: string | null | undefined): string {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }
  const [year, month, day] = raw.split('-')
  if (!year || !month || !day) {
    return raw
  }
  return `${day}/${month}/${year}`
}

function formatPeriodLabel(periodoInicio: string, periodoFin: string): string {
  return `${formatDate(periodoInicio)} - ${formatDate(periodoFin)}`
}

function buildLocalFileUrl(file: LocalRendicionFileRecord): string | null {
  if (file.url) {
    return file.url
  }
  if (!file.file_blob) {
    return null
  }
  return URL.createObjectURL(file.file_blob)
}

function toRendicionItem(record: LocalRendicionRecord): RendicionItem {
  return {
    id: record.remote_id ?? record.id,
    convenio: record.convenio,
    numero_rendicion: record.numero_rendicion,
    mes: record.mes,
    anio: record.anio,
    periodo_inicio: record.periodo_inicio,
    periodo_fin: record.periodo_fin,
    periodo_label: record.periodo_label,
    estado: record.estado,
    estado_label: record.estado_label,
    documento_adjunto: record.documento_adjunto,
    observaciones: record.observaciones,
    fecha_creacion: record.created_at,
    ultima_modificacion: record.updated_at,
    sync_status: record.sync_status,
    pending_action: record.pending_action || null,
    last_error: record.last_error || null,
  }
}

function toRendicionFileItem(file: LocalRendicionFileRecord): RendicionFileItem {
  return {
    id: file.remote_id ?? file.id,
    nombre: file.nombre,
    categoria: file.categoria,
    categoria_label: file.categoria_label,
    url: buildLocalFileUrl(file),
    estado: file.estado,
    estado_label: file.estado_label,
    observaciones: file.observaciones,
    fecha_creacion: file.created_at,
    ultima_modificacion: file.updated_at,
    sync_status: file.sync_status,
    pending_action: file.pending_action || null,
    last_error: file.last_error || null,
  }
}

function toDetail(
  record: LocalRendicionRecord,
  files: LocalRendicionFileRecord[],
): RendicionDetail {
  const grouped = new Map<string, LocalRendicionFileRecord[]>()
  for (const file of files) {
    if (file.pending_action === 'delete') {
      continue
    }
    const current = grouped.get(file.categoria) || []
    current.push(file)
    grouped.set(file.categoria, current)
  }

  return {
    ...toRendicionItem(record),
    comprobantes: files
      .filter((file) => file.pending_action !== 'delete')
      .map((file) => toRendicionFileItem(file)),
    documentacion: DOCUMENT_CATEGORIES.map((category) => ({
      ...category,
      archivos: (grouped.get(category.codigo) || [])
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((file) => toRendicionFileItem(file)),
    })),
  }
}

function toLocalFileRecord(
  rendicionId: string,
  file: RendicionFileItem,
): LocalRendicionFileRecord {
  const timestamp = nowIso()
  return {
    id: `remote-rendicion-file-${file.id}`,
    rendicion_id: rendicionId,
    remote_id: Number(file.id),
    categoria: file.categoria,
    categoria_label: file.categoria_label,
    nombre: file.nombre,
    file_blob: null,
    mime_type: null,
    url: file.url,
    estado: file.estado,
    estado_label: file.estado_label,
    observaciones: file.observaciones,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    created_at: file.fecha_creacion || timestamp,
    updated_at: file.ultima_modificacion || timestamp,
  }
}

function toLocalRendicionRecord(
  spaceId: number,
  detail: RendicionItem,
  existingId?: string,
): LocalRendicionRecord {
  const timestamp = nowIso()
  return {
    id: existingId || `remote-rendicion-${detail.id}`,
    space_id: spaceId,
    remote_id: Number(detail.id),
    convenio: detail.convenio,
    numero_rendicion: detail.numero_rendicion,
    mes: detail.mes,
    anio: detail.anio,
    periodo_inicio: detail.periodo_inicio,
    periodo_fin: detail.periodo_fin,
    periodo_label: detail.periodo_label,
    estado: detail.estado,
    estado_label: detail.estado_label,
    documento_adjunto: detail.documento_adjunto,
    observaciones: detail.observaciones,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    created_at: detail.fecha_creacion || timestamp,
    updated_at: detail.ultima_modificacion || timestamp,
  }
}

async function getExistingLocalByIdentifier(
  rendicionId: string | number,
): Promise<LocalRendicionRecord | undefined> {
  const rawId = String(rendicionId)
  const local = await db.rendiciones.get(rawId)
  if (local) {
    return local
  }
  const numericId = Number(rawId)
  if (Number.isNaN(numericId)) {
    return undefined
  }
  return db.rendiciones.where('remote_id').equals(numericId).first()
}

export async function syncRemoteRendicionDetailToLocal(
  spaceId: string | number,
  detail: RendicionDetail,
  preferredLocalId?: string,
): Promise<LocalRendicionRecord> {
  const parsedSpaceId = Number(spaceId)
  const existing =
    (preferredLocalId ? await db.rendiciones.get(preferredLocalId) : undefined)
    || (await db.rendiciones.where('remote_id').equals(Number(detail.id)).first())

  const localRecord = toLocalRendicionRecord(
    parsedSpaceId,
    detail,
    existing?.id || preferredLocalId,
  )

  await db.rendiciones.put({
    ...localRecord,
    created_at: existing?.created_at || localRecord.created_at,
  })

  const currentFiles = await db.rendicion_files
    .where('rendicion_id')
    .equals(localRecord.id)
    .toArray()

  const pendingFiles = currentFiles.filter((file) => file.pending_action)
  const pendingUploadIds = new Set(
    pendingFiles.filter((file) => file.pending_action === 'upload').map((file) => file.id),
  )

  const remoteFiles = detail.documentacion.flatMap((category) => category.archivos)
  const remoteIds = new Set<number>()
  for (const remoteFile of remoteFiles) {
    remoteIds.add(Number(remoteFile.id))
    const existingFile =
      currentFiles.find((file) => file.remote_id === Number(remoteFile.id))
      || currentFiles.find(
        (file) =>
          pendingUploadIds.has(file.id)
          && file.categoria === remoteFile.categoria
          && file.nombre === remoteFile.nombre,
      )

    await db.rendicion_files.put({
      ...toLocalFileRecord(localRecord.id, remoteFile),
      id: existingFile?.id || `remote-rendicion-file-${remoteFile.id}`,
      file_blob: existingFile?.file_blob || null,
      mime_type: existingFile?.mime_type || null,
    })
  }

  for (const file of currentFiles) {
    if (file.pending_action) {
      continue
    }
    if (file.remote_id && !remoteIds.has(file.remote_id)) {
      await db.rendicion_files.delete(file.id)
    }
  }

  return localRecord
}

async function syncRemoteRendicionList(spaceId: string | number): Promise<void> {
  const parsedSpaceId = Number(spaceId)
  const response = await listSpaceRendiciones(parsedSpaceId)
  const locals = await db.rendiciones.where('space_id').equals(parsedSpaceId).toArray()
  const localByRemoteId = new Map<number, LocalRendicionRecord>()
  for (const local of locals) {
    if (local.remote_id) {
      localByRemoteId.set(local.remote_id, local)
    }
  }

  const remoteIds = new Set<number>()
  for (const row of response.results) {
    remoteIds.add(Number(row.id))
    const existing = localByRemoteId.get(Number(row.id))
    if (existing?.pending_action) {
      continue
    }
    await db.rendiciones.put({
      ...toLocalRendicionRecord(parsedSpaceId, row, existing?.id),
      created_at: existing?.created_at || row.fecha_creacion || nowIso(),
    })
  }

  for (const local of locals) {
    if (local.pending_action || !local.remote_id) {
      continue
    }
    if (!remoteIds.has(local.remote_id)) {
      await db.rendiciones.delete(local.id)
      const files = await db.rendicion_files.where('rendicion_id').equals(local.id).toArray()
      await Promise.all(files.map((file) => db.rendicion_files.delete(file.id)))
    }
  }
}

export async function listOfflineRendiciones(
  spaceId: string | number,
): Promise<RendicionItem[]> {
  const parsedSpaceId = Number(spaceId)
  const rows = await db.rendiciones.where('space_id').equals(parsedSpaceId).toArray()
  return rows
    .filter((row) => row.pending_action !== 'delete')
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((row) => toRendicionItem(row))
}

export async function loadRendicionesOfflineFirst(
  spaceId: string | number,
): Promise<RendicionItem[]> {
  const localRows = await listOfflineRendiciones(spaceId)
  try {
    await syncRemoteRendicionList(spaceId)
  } catch {
    return localRows
  }
  return listOfflineRendiciones(spaceId)
}

export async function getRendicionDetailOfflineFirst(
  spaceId: string | number,
  rendicionId: string | number,
): Promise<RendicionDetail> {
  const local = await getExistingLocalByIdentifier(rendicionId)
  if (local) {
    const files = await db.rendicion_files.where('rendicion_id').equals(local.id).toArray()
    if (!local.remote_id || files.length > 0 || local.pending_action) {
      return toDetail(local, files)
    }
  }

  const remoteIdentifier = local?.remote_id || rendicionId
  const detail = await getSpaceRendicionDetail(spaceId, remoteIdentifier)
  const synced = await syncRemoteRendicionDetailToLocal(spaceId, detail, local?.id)
  const files = await db.rendicion_files.where('rendicion_id').equals(synced.id).toArray()
  return toDetail(synced, files)
}

export async function createRendicionOffline(
  spaceId: string | number,
  payload: CreateRendicionPayload,
): Promise<RendicionDetail> {
  const parsedSpaceId = Number(spaceId)
  const localId = `local-rendicion-${uuidv4()}`
  const timestamp = nowIso()
  const { month, year } = parseDateParts(payload.periodo_inicio)
  const record: LocalRendicionRecord = {
    id: localId,
    space_id: parsedSpaceId,
    remote_id: null,
    convenio: payload.convenio,
    numero_rendicion: payload.numero_rendicion,
    mes: month,
    anio: year,
    periodo_inicio: payload.periodo_inicio,
    periodo_fin: payload.periodo_fin,
    periodo_label: formatPeriodLabel(payload.periodo_inicio, payload.periodo_fin),
    estado: 'elaboracion',
    estado_label: RENDICION_STATUS_LABELS.elaboracion,
    documento_adjunto: false,
    observaciones: payload.observaciones || null,
    sync_status: 'pending',
    pending_action: 'create',
    last_error: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.rendiciones.put(record)
  await enqueueOutbox({
    type: 'CREATE_RENDICION',
    client_uuid: uuidv4(),
    payload: outboxPayload<CreateRendicionOutboxPayload>({
      local_id: localId,
      space_id: parsedSpaceId,
      data: payload,
    }),
  })

  return toDetail(record, [])
}

export async function queueRendicionFileUpload(params: {
  spaceId: string | number
  rendicionId: string | number
  categoria: string
  file: File
  name?: string
}): Promise<RendicionDetail> {
  const localRendicion = await getExistingLocalByIdentifier(params.rendicionId)
  if (!localRendicion) {
    throw new Error('No se encontró la rendición seleccionada.')
  }

  const category =
    DOCUMENT_CATEGORIES.find((item) => item.codigo === params.categoria)
    || {
      codigo: params.categoria,
      label: params.categoria,
      required: false,
      multiple: true,
      order: 999,
    }

  const currentFiles = await db.rendicion_files
    .where('rendicion_id')
    .equals(localRendicion.id)
    .toArray()

  if (!category.multiple) {
    const previous = currentFiles.find(
      (item) => item.categoria === params.categoria && item.pending_action !== 'delete',
    )
    if (previous) {
      if (previous.remote_id) {
        await deleteRendicionFileOffline(localRendicion.id, previous.id)
      } else {
        await db.rendicion_files.delete(previous.id)
      }
    }
  }

  const fileId = `local-rendicion-file-${uuidv4()}`
  const timestamp = nowIso()
  const storedName = String(params.name || '').trim() || params.file.name
  await db.rendicion_files.put({
    id: fileId,
    rendicion_id: localRendicion.id,
    remote_id: null,
    categoria: category.codigo,
    categoria_label: category.label,
    nombre: storedName,
    file_blob: params.file,
    mime_type: params.file.type || null,
    url: null,
    estado: 'presentado',
    estado_label: FILE_STATUS_LABELS.presentado,
    observaciones: null,
    sync_status: 'pending',
    pending_action: 'upload',
    last_error: null,
    created_at: timestamp,
    updated_at: timestamp,
  })

  await db.rendiciones.update(localRendicion.id, {
    documento_adjunto: true,
    updated_at: timestamp,
    sync_status: localRendicion.remote_id ? localRendicion.sync_status : 'pending',
  })

  await enqueueOutbox({
    type: 'UPLOAD_RENDICION_FILE',
    client_uuid: uuidv4(),
    payload: outboxPayload<UploadRendicionFileOutboxPayload>({
      local_rendicion_id: localRendicion.id,
      local_file_id: fileId,
      space_id: localRendicion.space_id,
      categoria: category.codigo,
      name: storedName,
    }),
  })

  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicion.id).toArray()
  return toDetail(localRendicion, files)
}

export async function deleteRendicionFileOffline(
  rendicionId: string | number,
  documentoId: string | number,
): Promise<RendicionDetail> {
  const localRendicion = await getExistingLocalByIdentifier(rendicionId)
  if (!localRendicion) {
    throw new Error('No se encontró la rendición seleccionada.')
  }

  const fileId = String(documentoId)
  const file =
    (await db.rendicion_files.get(fileId))
    || (await db.rendicion_files.where('remote_id').equals(Number(fileId)).first())
  if (!file) {
    const files = await db.rendicion_files.where('rendicion_id').equals(localRendicion.id).toArray()
    return toDetail(localRendicion, files)
  }

  if (!file.remote_id) {
    const outboxMatches = await db.outbox
      .where('type')
      .equals('UPLOAD_RENDICION_FILE')
      .filter(
        (row) => String(row.payload.local_file_id || '') === file.id,
      )
      .toArray()
    await Promise.all(
      outboxMatches.map((row) => (row.id ? db.outbox.delete(row.id) : Promise.resolve())),
    )
    await db.rendicion_files.delete(file.id)
  } else {
    await db.rendicion_files.update(file.id, {
      pending_action: 'delete',
      sync_status: 'pending',
      updated_at: nowIso(),
      last_error: null,
    })
    await enqueueOutbox({
      type: 'DELETE_RENDICION_FILE',
      client_uuid: uuidv4(),
      payload: outboxPayload<DeleteRendicionFileOutboxPayload>({
        local_rendicion_id: localRendicion.id,
        local_file_id: file.id,
        space_id: localRendicion.space_id,
      }),
    })
  }

  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicion.id).toArray()
  const visibleFiles = files.filter((item) => item.pending_action !== 'delete')
  await db.rendiciones.update(localRendicion.id, {
    documento_adjunto: visibleFiles.length > 0,
    updated_at: nowIso(),
  })

  const updated = await db.rendiciones.get(localRendicion.id)
  return toDetail(updated || localRendicion, files)
}

function validateRequiredDocumentation(files: LocalRendicionFileRecord[]): void {
  for (const category of DOCUMENT_CATEGORIES) {
    if (!category.required) {
      continue
    }
    const hasAny = files.some(
      (file) => file.categoria === category.codigo && file.pending_action !== 'delete',
    )
    if (!hasAny) {
      throw new Error(`Falta adjuntar ${category.label}.`)
    }
  }
}

export async function presentRendicionOffline(
  rendicionId: string | number,
): Promise<RendicionDetail> {
  const localRendicion = await getExistingLocalByIdentifier(rendicionId)
  if (!localRendicion) {
    throw new Error('No se encontró la rendición seleccionada.')
  }
  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicion.id).toArray()
  validateRequiredDocumentation(files)

  await db.rendiciones.update(localRendicion.id, {
    sync_status: 'pending',
    pending_action: 'present',
    updated_at: nowIso(),
    last_error: null,
  })

  const existing = await db.outbox
    .where('type')
    .equals('PRESENT_RENDICION')
    .filter(
      (row) => String(row.payload.local_rendicion_id || '') === localRendicion.id,
    )
    .first()

  if (existing?.id) {
    await db.outbox.update(existing.id, {
      status: 'pending',
      next_retry_at: null,
      last_error: null,
    })
  } else {
    await enqueueOutbox({
      type: 'PRESENT_RENDICION',
      client_uuid: uuidv4(),
      payload: outboxPayload<PresentRendicionOutboxPayload>({
        local_rendicion_id: localRendicion.id,
        space_id: localRendicion.space_id,
      }),
    })
  }

  const updated = await db.rendiciones.get(localRendicion.id)
  return toDetail(updated || localRendicion, files)
}

export async function deleteRendicionOffline(
  rendicionId: string | number,
): Promise<void> {
  const localRendicion = await getExistingLocalByIdentifier(rendicionId)
  if (!localRendicion) {
    return
  }

  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicion.id).toArray()
  if (!localRendicion.remote_id) {
    const outboxMatches = await db.outbox
      .filter(
        (row) => String(row.payload.local_rendicion_id || row.payload.local_id || '') === localRendicion.id,
      )
      .toArray()
    await Promise.all(
      outboxMatches.map((row) => (row.id ? db.outbox.delete(row.id) : Promise.resolve())),
    )
    await Promise.all(files.map((file) => db.rendicion_files.delete(file.id)))
    await db.rendiciones.delete(localRendicion.id)
    return
  }

  await db.rendiciones.update(localRendicion.id, {
    sync_status: 'pending',
    pending_action: 'delete',
    updated_at: nowIso(),
    last_error: null,
  })
  await enqueueOutbox({
    type: 'DELETE_RENDICION',
    client_uuid: uuidv4(),
    payload: outboxPayload<DeleteRendicionOutboxPayload>({
      local_rendicion_id: localRendicion.id,
      space_id: localRendicion.space_id,
    }),
  })
}

export async function verifyRendicionSynced(
  localRendicionId: string,
): Promise<boolean> {
  const local = await db.rendiciones.get(localRendicionId)
  if (!local?.remote_id) {
    return false
  }
  const detail = await getSpaceRendicionDetail(local.space_id, local.remote_id)
  await syncRemoteRendicionDetailToLocal(local.space_id, detail, local.id)
  const refreshed = await db.rendiciones.get(local.id)
  const files = await db.rendicion_files.where('rendicion_id').equals(local.id).toArray()
  return Boolean(
    refreshed
      && refreshed.sync_status === 'synced'
      && refreshed.pending_action === null
      && files.every((file) => file.sync_status === 'synced' && !file.pending_action),
  )
}

export function outboxTypesForRendicion(): OutboxRecord['type'][] {
  return [
    'CREATE_RENDICION',
    'UPLOAD_RENDICION_FILE',
    'DELETE_RENDICION_FILE',
    'PRESENT_RENDICION',
    'DELETE_RENDICION',
  ]
}

export function getDocumentCategoryConfig(categoria: string): DocumentCategoryConfig | undefined {
  return DOCUMENT_CATEGORIES.find((item) => item.codigo === categoria)
}

export async function markRendicionError(
  localRendicionId: string,
  message: string,
): Promise<void> {
  await db.rendiciones.update(localRendicionId, {
    sync_status: 'failed',
    last_error: message,
    updated_at: nowIso(),
  })
}

export async function markRendicionFileError(
  localFileId: string,
  message: string,
): Promise<void> {
  await db.rendicion_files.update(localFileId, {
    sync_status: 'failed',
    last_error: message,
    updated_at: nowIso(),
  })
}

export async function getRendicionPendingUploadsCount(localRendicionId: string): Promise<number> {
  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicionId).toArray()
  return files.filter((file) => file.pending_action === 'upload').length
}

export async function getLocalRendicionFile(
  localFileId: string,
): Promise<LocalRendicionFileRecord | undefined> {
  return db.rendicion_files.get(localFileId)
}

export async function getLocalRendicion(
  localRendicionId: string,
): Promise<LocalRendicionRecord | undefined> {
  return db.rendiciones.get(localRendicionId)
}

export async function getLocalRendicionByRemoteId(
  remoteId: number,
): Promise<LocalRendicionRecord | undefined> {
  return db.rendiciones.where('remote_id').equals(remoteId).first()
}

export async function removeLocalRendicion(localRendicionId: string): Promise<void> {
  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicionId).toArray()
  await Promise.all(files.map((file) => db.rendicion_files.delete(file.id)))
  await db.rendiciones.delete(localRendicionId)
}

export async function removeLocalRendicionFile(localFileId: string): Promise<void> {
  await db.rendicion_files.delete(localFileId)
}

export async function syncCreateRendicionFromServer(
  localRendicionId: string,
  created: RendicionDetail,
): Promise<void> {
  await syncRemoteRendicionDetailToLocal(created.id, created, localRendicionId)
}

export async function syncPresentRendicionFromServer(
  localRendicionId: string,
  spaceId: number,
  remoteId: number,
): Promise<void> {
  const detail = await getSpaceRendicionDetail(spaceId, remoteId)
  await syncRemoteRendicionDetailToLocal(spaceId, detail, localRendicionId)
}

export async function syncDeleteRendicionFileFromServer(
  localRendicionId: string,
  spaceId: number,
  remoteId: number,
): Promise<void> {
  const detail = await getSpaceRendicionDetail(spaceId, remoteId)
  await syncRemoteRendicionDetailToLocal(spaceId, detail, localRendicionId)
}

export async function uploadFileToServer(params: {
  spaceId: number
  remoteRendicionId: number
  localFile: LocalRendicionFileRecord
}): Promise<RendicionDetail> {
  const blob = params.localFile.file_blob
  if (!blob) {
    throw new Error('No se encontró el archivo local para sincronizar.')
  }
  const file = new File([blob], params.localFile.nombre, {
    type: params.localFile.mime_type || undefined,
  })
  return uploadRendicionFile({
    spaceId: params.spaceId,
    rendicionId: params.remoteRendicionId,
    categoria: params.localFile.categoria,
    file,
    name: params.localFile.nombre,
  })
}

export async function deleteRendicionFileOnServer(params: {
  spaceId: number
  remoteRendicionId: number
  remoteFileId: number
}): Promise<void> {
  await deleteRendicionFile({
    spaceId: params.spaceId,
    rendicionId: params.remoteRendicionId,
    documentoId: params.remoteFileId,
  })
}

export async function presentRendicionOnServer(
  spaceId: number,
  remoteRendicionId: number,
): Promise<void> {
  await presentRendicion(spaceId, remoteRendicionId)
}

export async function createRendicionOnServer(
  spaceId: number,
  payload: CreateRendicionPayload,
): Promise<RendicionDetail> {
  return createSpaceRendicion(spaceId, payload)
}

export async function deleteRendicionOnServer(
  spaceId: number,
  remoteRendicionId: number,
): Promise<void> {
  await deleteSpaceRendicion(spaceId, remoteRendicionId)
}

export { formatDateTime }
