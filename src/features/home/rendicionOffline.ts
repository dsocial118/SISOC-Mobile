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
  type RendicionModeloItem,
} from '../../api/rendicionApi'
import {
  db,
  type LocalRendicionFileRecord,
  type LocalRendicionRecord,
  type OutboxRecord,
} from '../../db/database'
import { getCurrentUserKey } from '../../auth/session'
import { enqueueOutbox } from '../../sync/outbox'

type DocumentCategoryConfig = Omit<RendicionDocumentCategory, 'archivos'>
type RendicionLineaProgramatica = 'secos' | 'tradicional'

const LINEA_LABELS: Record<RendicionLineaProgramatica, string> = {
  secos: 'Abordaje Comunitario - Línea Secos',
  tradicional: 'Abordaje Comunitario - Línea Tradicional',
}

const DOCUMENT_CATEGORIES: DocumentCategoryConfig[] = [
  {
    codigo: 'formulario_i',
    label: 'Formulario I - Certificación de Cuenta Bancaria',
    required: true,
    multiple: false,
    order: 1,
  },
  {
    codigo: 'formulario_ii',
    label: 'Formulario II - Resumen',
    required: true,
    multiple: false,
    order: 2,
  },
  {
    codigo: 'formulario_iii_alimentario',
    label: 'Formulario III - Desagregado por Facturas Prestación Alimentaria',
    required: true,
    multiple: false,
    order: 3,
  },
  {
    codigo: 'formulario_iii_siph',
    label: 'Formulario III - Desagregado por Facturas SIPH',
    required: true,
    multiple: false,
    order: 4,
  },
  {
    codigo: 'formulario_iv',
    label: 'Formulario IV - Recibo de Fondos',
    required: false,
    multiple: false,
    order: 5,
  },
  {
    codigo: 'formulario_v_alimentario',
    label: 'Formulario V - Certificación de Prestaciones Alimentarias',
    required: true,
    multiple: false,
    order: 6,
  },
  {
    codigo: 'formulario_v_siph',
    label: 'Formulario V - Certificación de SIPH',
    required: true,
    multiple: false,
    order: 7,
  },
  {
    codigo: 'formulario_vi',
    label: 'Formulario VI - Planilla de Pagos',
    required: false,
    multiple: false,
    order: 8,
  },
  {
    codigo: 'extracto_bancario',
    label: 'Extracto Bancario',
    required: true,
    multiple: false,
    order: 9,
  },
  {
    codigo: 'comprobantes',
    label: 'Comprobante/s',
    required: true,
    multiple: true,
    order: 10,
  },
  {
    codigo: 'planilla_seguros',
    label: 'Planilla de Seguros',
    required: false,
    multiple: false,
    order: 11,
  },
  {
    codigo: 'otros',
    label: 'Documentación Adicional',
    required: false,
    multiple: true,
    order: 12,
  },
]

const MODELOS_POR_LINEA: Record<
  RendicionLineaProgramatica,
  Array<Omit<RendicionModeloItem, 'url'>>
> = {
  secos: [
    {
      codigo: 'formulario_i',
      label: 'Formulario I - Certificación de Cuenta Bancaria',
      filename: 'FORM.I.MS.-Certificacion.de.CUENTA.BANCARIA.2.xlsx',
      order: 1,
    },
    {
      codigo: 'formulario_ii',
      label: 'Formulario II - Resumen',
      filename: 'FORM.II.MS.-RESUMEN.1.xlsx',
      order: 2,
    },
    {
      codigo: 'formulario_iii_alimentario',
      label: 'Formulario III - Desagregado por Facturas Prestación Alimentaria',
      filename: 'FORM.III.MS.-.DESAGREGADO.ALIM.1.xlsx',
      order: 3,
    },
    {
      codigo: 'formulario_iii_siph',
      label: 'Formulario III - Desagregado por Facturas SIPH',
      filename: 'FORM.III.MS.-.DESAGREGADO.SIPH.1.xlsx',
      order: 4,
    },
    {
      codigo: 'formulario_iv',
      label: 'Formulario IV - Recibo de Fondos',
      filename: 'FORM.IV.MS.-.RECIBO.FONDOS.1.xlsx',
      order: 5,
    },
    {
      codigo: 'formulario_v_alimentario',
      label: 'Formulario V - Certificación de Prestaciones Alimentarias',
      filename: 'FORM.V.MS.-.CERTIF.PRESTAC.ALIM.1.xlsx',
      order: 6,
    },
    {
      codigo: 'formulario_v_siph',
      label: 'Formulario V - Certificación de SIPH',
      filename: 'FORM.V.MS.-.CERTIF.SS.INT.PRO.HUM.1.xlsx',
      order: 7,
    },
    {
      codigo: 'formulario_vi',
      label: 'Formulario VI - Planilla de Pagos',
      filename: 'FORMULARIO.VI.-.CONTROL.PAGOS.3.xlsx',
      order: 8,
    },
  ],
  tradicional: [
    {
      codigo: 'formulario_i',
      label: 'Formulario I - Certificación de Cuenta Bancaria',
      filename: 'FORM.I.-Certificacion.de.CUENTA.BANCARIA.1.xlsx',
      order: 1,
    },
    {
      codigo: 'formulario_ii',
      label: 'Formulario II - Resumen',
      filename: 'FORM.II.RMC.AF.1.xlsx',
      order: 2,
    },
    {
      codigo: 'formulario_iii_alimentario',
      label: 'Formulario III - Desagregado por Facturas Prestación Alimentaria',
      filename: 'FORM.III.RMC.ALIM.1.xlsx',
      order: 3,
    },
    {
      codigo: 'formulario_iii_siph',
      label: 'Formulario III - Desagregado por Facturas SIPH',
      filename: 'FORM.III.RMC.SIPH.1.xlsx',
      order: 4,
    },
    {
      codigo: 'formulario_iv',
      label: 'Formulario IV - Recibo de Fondos',
      filename: 'FORM.IV.RMC.AF.xlsx',
      order: 5,
    },
    {
      codigo: 'formulario_v_alimentario',
      label: 'Formulario V - Certificación de Prestaciones Alimentarias',
      filename: 'FORM.V.CERTIF.ALIM.1.xlsx',
      order: 6,
    },
    {
      codigo: 'formulario_v_siph',
      label: 'Formulario V - Certificación de SIPH',
      filename: 'FORM.V.CERTIF.SIPH.1.xlsx',
      order: 7,
    },
    {
      codigo: 'formulario_vi',
      label: 'Formulario VI - Planilla de Pagos',
      filename: 'FORM.VI.RMC.AF.1.xlsx',
      order: 8,
    },
  ],
}

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

function supportsSubsanacionHistoryCategory(categoria: string): boolean {
  return categoria === 'comprobantes' || categoria === 'otros'
}

function normalizeLineaProgramatica(value: string | null | undefined): RendicionLineaProgramatica {
  return value === 'secos' ? 'secos' : 'tradicional'
}

function buildModeloUrl(
  spaceId: number,
  linea: RendicionLineaProgramatica,
  codigo: string,
): string {
  return `/api/comedores/${spaceId}/rendiciones/modelos/${linea}/${codigo}/download/`
}

function buildModelosDescargables(
  spaceId: number,
  lineaProgramatica: string | null | undefined,
): RendicionModeloItem[] {
  const linea = normalizeLineaProgramatica(lineaProgramatica)
  return MODELOS_POR_LINEA[linea].map((modelo) => ({
    ...modelo,
    url: buildModeloUrl(spaceId, linea, modelo.codigo),
  }))
}

function fixDisplayText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return value
    .replace(/Ã³/g, 'ó')
    .replace(/Ã­/g, 'í')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á')
}

function toVisualFileStatus(file: {
  estado_visual_override?: string | null
  estado_label_visual_override?: string | null
  estado: string
  estado_label?: string
}): { estadoVisual: string; estadoLabelVisual: string } {
  if (file.estado_visual_override && file.estado_label_visual_override) {
    return {
      estadoVisual: file.estado_visual_override,
      estadoLabelVisual: file.estado_label_visual_override,
    }
  }
  return {
    estadoVisual: file.estado,
    estadoLabelVisual: file.estado_label || FILE_STATUS_LABELS[file.estado] || file.estado,
  }
}

function flattenDetailFiles(detail: RendicionDetail): RendicionFileItem[] {
  return detail.documentacion.flatMap((category) =>
    category.archivos.flatMap((file) => [file, ...(file.subsanaciones || [])]),
  )
}

function buildDetailDocumentacion(
  files: LocalRendicionFileRecord[],
  record: LocalRendicionRecord,
): RendicionDocumentCategory[] {
  const activeFiles = files.filter((file) => file.pending_action !== 'delete')
  const modelos = new Map(
    buildModelosDescargables(record.space_id, record.linea_programatica).map((modelo) => [
      modelo.codigo,
      modelo,
    ]),
  )

  return DOCUMENT_CATEGORIES.map((category) => ({
    ...category,
    label: category.codigo === 'otros' ? 'Documentación Adicional' : category.label,
    modelo: modelos.get(category.codigo) || null,
    archivos: (() => {
      const categoryFiles = activeFiles.filter((file) => file.categoria === category.codigo)
      if (!supportsSubsanacionHistoryCategory(category.codigo)) {
        return categoryFiles
          .sort((left, right) => left.created_at.localeCompare(right.created_at))
          .map((file) => {
            const item = toRendicionFileItem(file)
            item.subsanaciones = []
            return item
          })
      }

      const filesById = new Map(
        categoryFiles.map((file) => [String(file.remote_id || file.id), file] as const),
      )
      const childrenByParentId = new Map<string, LocalRendicionFileRecord[]>()
      for (const file of categoryFiles) {
        const parentId = String(file.documento_subsanado || '').trim()
        if (!parentId || !filesById.has(parentId)) {
          continue
        }
        const current = childrenByParentId.get(parentId) || []
        current.push(file)
        childrenByParentId.set(parentId, current)
      }

      const roots = categoryFiles.filter((file) => {
        const parentId = String(file.documento_subsanado || '').trim()
        return !parentId || !filesById.has(parentId)
      })

      return roots
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
        .map((root) => {
          const chain: LocalRendicionFileRecord[] = []
          const pending: LocalRendicionFileRecord[] = [root]
          while (pending.length > 0) {
            const current = pending.shift()
            if (!current) {
              continue
            }
            chain.push(current)
            pending.push(
              ...(
                childrenByParentId.get(String(current.remote_id || current.id)) || []
              ).sort((left, right) => left.created_at.localeCompare(right.created_at)),
            )
          }

          const principal =
            [...chain].sort((left, right) => {
              const byDate = left.created_at.localeCompare(right.created_at)
              if (byDate !== 0) {
                return byDate
              }
              return String(left.remote_id || left.id).localeCompare(
                String(right.remote_id || right.id),
              )
            })[chain.length - 1] || root
          const item = toRendicionFileItem(principal, {
            estadoVisual: principal.estado,
            estadoLabelVisual:
              principal.estado_label || FILE_STATUS_LABELS[principal.estado] || principal.estado,
          })
          item.subsanaciones = chain
            .filter((file) => file.id !== principal.id)
            .sort((left, right) => right.created_at.localeCompare(left.created_at))
            .map((historyFile) =>
              toRendicionFileItem(historyFile, {
                estadoVisual: 'subsanado',
                estadoLabelVisual: 'Subsanado',
              }),
            )
          return item
        })
    })(),
  }))
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
  documento_subsanado_id?: number | string
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

async function requireCurrentUserKey(): Promise<string> {
  const userKey = await getCurrentUserKey()
  if (!userKey) {
    throw new Error('La sesión expiró. Volvé a ingresar.')
  }
  return userKey
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

function normalizeFileName(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
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
  const linea = normalizeLineaProgramatica(record.linea_programatica)
  return {
    id: record.remote_id ?? record.id,
    convenio: record.convenio,
    numero_rendicion: record.numero_rendicion,
    mes: record.mes,
    anio: record.anio,
    periodo_inicio: record.periodo_inicio,
    periodo_fin: record.periodo_fin,
    periodo_label: record.periodo_label,
    linea_programatica: linea,
    linea_programatica_label:
      fixDisplayText(record.linea_programatica_label) || LINEA_LABELS[linea],
    estado: record.estado,
    estado_label: fixDisplayText(record.estado_label) || record.estado_label,
    documento_adjunto: record.documento_adjunto,
    observaciones: record.observaciones,
    fecha_creacion: record.created_at,
    ultima_modificacion: record.updated_at,
    sync_status: record.sync_status,
    pending_action: record.pending_action || null,
    last_error: record.last_error || null,
  }
}

function toRendicionFileItem(
  file: LocalRendicionFileRecord,
  overrides?: {
    estadoVisual?: string
    estadoLabelVisual?: string
  },
): RendicionFileItem {
  const visualStatus = toVisualFileStatus({
    ...file,
    estado_visual_override: overrides?.estadoVisual ?? null,
    estado_label_visual_override: overrides?.estadoLabelVisual ?? null,
  })
  return {
    id: file.remote_id || file.id,
    nombre: file.nombre,
    categoria: file.categoria,
    categoria_label: fixDisplayText(file.categoria_label) || file.categoria_label,
    documento_subsanado:
      typeof file.documento_subsanado === 'number'
        ? file.documento_subsanado
        : file.documento_subsanado
          ? Number(file.documento_subsanado)
          : null,
    url: buildLocalFileUrl(file),
    estado: file.estado,
    estado_label: fixDisplayText(file.estado_label) || file.estado_label,
    estado_visual: visualStatus.estadoVisual,
    estado_label_visual:
      fixDisplayText(visualStatus.estadoLabelVisual) || visualStatus.estadoLabelVisual,
    observaciones: file.observaciones,
    fecha_creacion: file.created_at,
    ultima_modificacion: file.updated_at,
    subsanaciones: [],
    sync_status: file.sync_status,
    pending_action: file.pending_action || null,
    last_error: file.last_error || null,
  }
}

function toDetail(
  record: LocalRendicionRecord,
  files: LocalRendicionFileRecord[],
): RendicionDetail {
  return {
    ...toRendicionItem(record),
    comprobantes: files
      .filter((file) => file.pending_action !== 'delete')
      .map((file) => toRendicionFileItem(file)),
    documentacion: buildDetailDocumentacion(files, record),
    modelos: buildModelosDescargables(record.space_id, record.linea_programatica),
  }
}

function toLocalFileRecord(
  rendicionId: string,
  userKey: string,
  file: RendicionFileItem,
): LocalRendicionFileRecord {
  const timestamp = nowIso()
  return {
    id: `remote-rendicion-file-${file.id}`,
    user_key: userKey,
    rendicion_id: rendicionId,
    remote_id: Number(file.id),
    categoria: file.categoria,
    categoria_label: file.categoria_label,
    documento_subsanado: file.documento_subsanado,
    nombre: file.nombre,
    file_blob: null,
    mime_type: null,
    url: file.url,
    estado: file.estado,
    estado_label: file.estado_label,
    estado_visual_override: file.estado_visual || null,
    estado_label_visual_override: file.estado_label_visual || null,
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
  userKey: string,
  detail: RendicionItem,
  existingId?: string,
): LocalRendicionRecord {
  const timestamp = nowIso()
  return {
    id: existingId || `remote-rendicion-${detail.id}`,
    user_key: userKey,
    space_id: spaceId,
    remote_id: Number(detail.id),
    convenio: detail.convenio,
    numero_rendicion: detail.numero_rendicion,
    mes: detail.mes,
    anio: detail.anio,
    periodo_inicio: detail.periodo_inicio,
    periodo_fin: detail.periodo_fin,
    periodo_label: detail.periodo_label,
    linea_programatica: detail.linea_programatica || null,
    linea_programatica_label: detail.linea_programatica_label || null,
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
  const userKey = await requireCurrentUserKey()
  const rawId = String(rendicionId)
  const local = await db.rendiciones.get(rawId)
  if (local?.user_key === userKey) {
    return local
  }
  const numericId = Number(rawId)
  if (Number.isNaN(numericId)) {
    return undefined
  }
  const rows = await db.rendiciones.where('remote_id').equals(numericId).toArray()
  return rows.find((row) => row.user_key === userKey)
}

export async function resolveLocalRendicionId(
  rendicionId: string | number,
): Promise<string | null> {
  const local = await getExistingLocalByIdentifier(rendicionId)
  return local?.id || null
}

export async function syncRemoteRendicionDetailToLocal(
  spaceId: string | number,
  detail: RendicionDetail,
  preferredLocalId?: string,
): Promise<LocalRendicionRecord> {
  const userKey = await requireCurrentUserKey()
  const parsedSpaceId = Number(spaceId)
  const existing =
    (preferredLocalId ? await db.rendiciones.get(preferredLocalId) : undefined)
    || (await db.rendiciones.where('remote_id').equals(Number(detail.id)).toArray()).find(
      (row) => row.user_key === userKey,
    )

  const localRecord = toLocalRendicionRecord(
    parsedSpaceId,
    userKey,
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

  const remoteFiles = flattenDetailFiles(detail)
  const remoteIds = new Set<number>()
  for (const remoteFile of remoteFiles) {
    remoteIds.add(Number(remoteFile.id))
    const existingFile =
      currentFiles.find((file) => file.remote_id === Number(remoteFile.id))
      || currentFiles.find(
        (file) =>
          pendingUploadIds.has(file.id)
          && file.categoria === remoteFile.categoria
          && normalizeFileName(file.nombre) === normalizeFileName(remoteFile.nombre)
          && String(file.documento_subsanado || '') === String(remoteFile.documento_subsanado || ''),
      )
      || currentFiles.find(
        (file) =>
          pendingUploadIds.has(file.id)
          && file.categoria === remoteFile.categoria
          && String(file.documento_subsanado || '') === String(remoteFile.documento_subsanado || ''),
      )

    await db.rendicion_files.put({
      ...toLocalFileRecord(localRecord.id, userKey, remoteFile),
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
  const userKey = await requireCurrentUserKey()
  const parsedSpaceId = Number(spaceId)
  const response = await listSpaceRendiciones(parsedSpaceId)
  const locals = await db.rendiciones.where('space_id').equals(parsedSpaceId).toArray()
  const localByRemoteId = new Map<number, LocalRendicionRecord>()
  for (const local of locals.filter((row) => row.user_key === userKey)) {
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
      ...toLocalRendicionRecord(parsedSpaceId, userKey, row, existing?.id),
      created_at: existing?.created_at || row.fecha_creacion || nowIso(),
    })
  }

  for (const local of locals.filter((row) => row.user_key === userKey)) {
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
  const userKey = await requireCurrentUserKey()
  const parsedSpaceId = Number(spaceId)
  const rows = await db.rendiciones.where('space_id').equals(parsedSpaceId).toArray()
  return rows
    .filter((row) => row.user_key === userKey)
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
    const hasPendingFiles = files.some((file) => Boolean(file.pending_action))
    if (!local.remote_id || local.pending_action || hasPendingFiles) {
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
  const userKey = await requireCurrentUserKey()
  const parsedSpaceId = Number(spaceId)
  const localId = `local-rendicion-${uuidv4()}`
  const timestamp = nowIso()
  const { month, year } = parseDateParts(payload.periodo_inicio)
  const record: LocalRendicionRecord = {
    id: localId,
    user_key: userKey,
    space_id: parsedSpaceId,
    remote_id: null,
    convenio: payload.convenio,
    numero_rendicion: payload.numero_rendicion,
    mes: month,
    anio: year,
    periodo_inicio: payload.periodo_inicio,
    periodo_fin: payload.periodo_fin,
    periodo_label: formatPeriodLabel(payload.periodo_inicio, payload.periodo_fin),
    linea_programatica: payload.linea_programatica || 'tradicional',
    linea_programatica_label:
      payload.linea_programatica === 'secos'
        ? 'Abordaje Comunitario - Línea Secos'
        : 'Abordaje Comunitario - Línea Tradicional',
    estado: 'elaboracion',
    estado_label: RENDICION_STATUS_LABELS.elaboracion,
    documento_adjunto: false,
    observaciones: payload.observaciones || null,
    sync_status: 'synced',
    pending_action: null,
    last_error: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.rendiciones.put(record)

  return toDetail(record, [])
}

export async function updateRendicionLineaProgramaticaOffline(
  rendicionId: string | number,
  lineaProgramatica: RendicionLineaProgramatica,
): Promise<RendicionDetail> {
  const localRendicion = await getExistingLocalByIdentifier(rendicionId)
  if (!localRendicion) {
    throw new Error('No se encontró la rendición seleccionada.')
  }
  if (localRendicion.estado !== 'elaboracion') {
    throw new Error('La línea programática solo puede modificarse en elaboración.')
  }

  const linea = normalizeLineaProgramatica(lineaProgramatica)
  await db.rendiciones.update(localRendicion.id, {
    linea_programatica: linea,
    linea_programatica_label: LINEA_LABELS[linea],
    updated_at: nowIso(),
  })

  const pendingCreates = await db.outbox
    .where('type')
    .equals('CREATE_RENDICION')
    .toArray()
  await Promise.all(
    pendingCreates
      .filter((row) => String(row.payload.local_id || '') === localRendicion.id)
      .map((row) => {
        if (!row.id) {
          return Promise.resolve()
        }
        return db.outbox.update(row.id, {
          payload: {
            ...row.payload,
            data: {
              ...((row.payload.data || {}) as Record<string, unknown>),
              linea_programatica: linea,
            },
          },
        })
      }),
  )

  const updated = await db.rendiciones.get(localRendicion.id)
  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicion.id).toArray()
  return toDetail(updated || localRendicion, files)
}

export async function queueRendicionFileUpload(params: {
  spaceId: string | number
  rendicionId: string | number
  categoria: string
  file: File
  name?: string
  documentoSubsanadoId?: number | string
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

  if (!category.multiple && !params.documentoSubsanadoId) {
    const previous = currentFiles.find(
      (item) =>
        item.categoria === params.categoria
        && item.pending_action !== 'delete'
        && !item.documento_subsanado,
    )
    if (previous) {
      if (previous.remote_id && localRendicion.estado !== 'subsanar') {
        await deleteRendicionFileOffline(localRendicion.id, previous.id)
      } else if (!previous.remote_id) {
        await db.rendicion_files.delete(previous.id)
      }
    }
  }

  const fileId = `local-rendicion-file-${uuidv4()}`
  const timestamp = nowIso()
  const storedName = String(params.name || '').trim() || params.file.name
  await db.rendicion_files.put({
    id: fileId,
    user_key: await requireCurrentUserKey(),
    rendicion_id: localRendicion.id,
    remote_id: null,
    categoria: category.codigo,
    categoria_label: category.label,
    documento_subsanado: params.documentoSubsanadoId ?? null,
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
    last_error: null,
  })

  if (localRendicion.remote_id) {
    await enqueueOutbox({
      type: 'UPLOAD_RENDICION_FILE',
      client_uuid: uuidv4(),
      payload: outboxPayload<UploadRendicionFileOutboxPayload>({
        local_rendicion_id: localRendicion.id,
        local_file_id: fileId,
        space_id: localRendicion.space_id,
        categoria: category.codigo,
        name: storedName,
        documento_subsanado_id: params.documentoSubsanadoId,
      }),
    })
  }

  const updated = await db.rendiciones.get(localRendicion.id)
  const files = await db.rendicion_files.where('rendicion_id').equals(localRendicion.id).toArray()
  return toDetail(updated || localRendicion, files)
}

function buildCreatePayloadFromLocal(record: LocalRendicionRecord): CreateRendicionPayload {
  return {
    convenio: record.convenio || '',
    numero_rendicion: record.numero_rendicion || 0,
    periodo_inicio: record.periodo_inicio || '',
    periodo_fin: record.periodo_fin || '',
    linea_programatica: record.linea_programatica || 'tradicional',
    observaciones: record.observaciones || undefined,
  }
}

async function ensureCreateRendicionQueued(localRendicion: LocalRendicionRecord): Promise<void> {
  if (localRendicion.remote_id) {
    return
  }
  const existing = await db.outbox
    .where('type')
    .equals('CREATE_RENDICION')
    .filter((row) => String(row.payload.local_id || '') === localRendicion.id)
    .first()
  const payload = outboxPayload<CreateRendicionOutboxPayload>({
    local_id: localRendicion.id,
    space_id: localRendicion.space_id,
    data: buildCreatePayloadFromLocal(localRendicion),
  })
  if (existing?.id) {
    await db.outbox.update(existing.id, {
      payload,
      status: 'pending',
      next_retry_at: null,
      last_error: null,
    })
    return
  }
  await enqueueOutbox({
    type: 'CREATE_RENDICION',
    client_uuid: uuidv4(),
    payload,
  })
}

async function ensurePendingUploadsQueued(
  localRendicion: LocalRendicionRecord,
  files: LocalRendicionFileRecord[],
): Promise<void> {
  await Promise.all(
    files
      .filter((file) => file.pending_action === 'upload')
      .map(async (file) => {
        await db.rendicion_files.update(file.id, {
          sync_status: 'pending',
          last_error: null,
          updated_at: nowIso(),
        })
        const existing = await db.outbox
          .where('type')
          .equals('UPLOAD_RENDICION_FILE')
          .filter((row) => String(row.payload.local_file_id || '') === file.id)
          .first()
        const payload = outboxPayload<UploadRendicionFileOutboxPayload>({
          local_rendicion_id: localRendicion.id,
          local_file_id: file.id,
          space_id: localRendicion.space_id,
          categoria: file.categoria,
          name: file.nombre,
          documento_subsanado_id: file.documento_subsanado ?? undefined,
        })
        if (existing?.id) {
          await db.outbox.update(existing.id, {
            payload,
            status: 'pending',
            next_retry_at: null,
            last_error: null,
          })
          return
        }
        await enqueueOutbox({
          type: 'UPLOAD_RENDICION_FILE',
          client_uuid: uuidv4(),
          payload,
        })
      }),
  )
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
  const rendicionToPresent: LocalRendicionRecord = {
    ...localRendicion,
    sync_status: 'pending',
    pending_action: 'present',
    last_error: null,
  }
  await ensureCreateRendicionQueued(rendicionToPresent)
  await ensurePendingUploadsQueued(rendicionToPresent, files)

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

export async function releaseRendicionPresentError(
  localRendicionId: string,
  message?: string | null,
): Promise<void> {
  await db.rendiciones.update(localRendicionId, {
    sync_status: 'failed',
    pending_action: null,
    last_error: message || null,
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
  const userKey = await requireCurrentUserKey()
  const rows = await db.outbox
    .where('type')
    .equals('UPLOAD_RENDICION_FILE')
    .filter(
      (row) =>
        row.user_key === userKey
        && String(row.payload.local_rendicion_id || '') === localRendicionId,
    )
    .toArray()
  return rows.length
}

export async function getLocalRendicionFile(
  localFileId: string,
): Promise<LocalRendicionFileRecord | undefined> {
  const userKey = await requireCurrentUserKey()
  const file = await db.rendicion_files.get(localFileId)
  return file?.user_key === userKey ? file : undefined
}

export async function getLocalRendicion(
  localRendicionId: string,
): Promise<LocalRendicionRecord | undefined> {
  const userKey = await requireCurrentUserKey()
  const rendicion = await db.rendiciones.get(localRendicionId)
  return rendicion?.user_key === userKey ? rendicion : undefined
}

export async function getLocalRendicionByRemoteId(
  remoteId: number,
): Promise<LocalRendicionRecord | undefined> {
  const userKey = await requireCurrentUserKey()
  const rows = await db.rendiciones.where('remote_id').equals(remoteId).toArray()
  return rows.find((row) => row.user_key === userKey)
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
    documentoSubsanadoId: params.localFile.documento_subsanado ?? undefined,
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
