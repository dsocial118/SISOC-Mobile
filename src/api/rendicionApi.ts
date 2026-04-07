import { http } from './http'

export interface RendicionFileItem {
  id: number | string
  nombre: string
  categoria: string
  categoria_label: string
  documento_subsanado: number | null
  url: string | null
  estado: string
  estado_label: string
  estado_visual?: string
  estado_label_visual?: string
  observaciones: string | null
  fecha_creacion: string
  ultima_modificacion: string
  subsanaciones?: RendicionFileItem[]
  sync_status?: 'pending' | 'synced' | 'failed'
  pending_action?: 'upload' | 'delete' | null
  last_error?: string | null
}

export interface RendicionDocumentCategory {
  codigo: string
  label: string
  required: boolean
  multiple: boolean
  order: number
  archivos: RendicionFileItem[]
}

export interface RendicionItem {
  id: number | string
  convenio: string | null
  numero_rendicion: number | null
  mes: number
  anio: number
  periodo_inicio: string | null
  periodo_fin: string | null
  periodo_label: string
  estado: string
  estado_label: string
  documento_adjunto: boolean
  observaciones: string | null
  fecha_creacion: string
  ultima_modificacion: string
  sync_status?: 'pending' | 'synced' | 'failed'
  pending_action?: 'create' | 'present' | 'delete' | null
  last_error?: string | null
}

export interface RendicionDetail extends RendicionItem {
  comprobantes: RendicionFileItem[]
  documentacion: RendicionDocumentCategory[]
}

interface PaginatedResponse<T> {
  count: number
  num_pages: number
  current_page: number
  results: T[]
}

const inflightListRequests = new Map<string, Promise<PaginatedResponse<RendicionItem>>>()

export interface CreateRendicionPayload {
  convenio: string
  numero_rendicion: number
  periodo_inicio: string
  periodo_fin: string
  observaciones?: string
}

export async function listSpaceRendiciones(
  spaceId: string | number,
): Promise<PaginatedResponse<RendicionItem>> {
  const requestKey = String(spaceId)
  const inflightRequest = inflightListRequests.get(requestKey)
  if (inflightRequest) {
    return inflightRequest
  }

  const request = http
    .get<PaginatedResponse<RendicionItem>>(`/comedores/${spaceId}/rendiciones/`, {
      timeout: 30000,
    })
    .then(({ data }) => data)
    .finally(() => {
      inflightListRequests.delete(requestKey)
    })

  inflightListRequests.set(requestKey, request)
  return request
}

export async function createSpaceRendicion(
  spaceId: string | number,
  payload: CreateRendicionPayload,
): Promise<RendicionDetail> {
  const { data } = await http.post<RendicionDetail>(`/comedores/${spaceId}/rendiciones/`, payload)
  return data
}

export async function getSpaceRendicionDetail(
  spaceId: string | number,
  rendicionId: string | number,
): Promise<RendicionDetail> {
  const { data } = await http.get<RendicionDetail>(
    `/comedores/${spaceId}/rendiciones/${rendicionId}/`,
    {
      timeout: 30000,
    },
  )
  return data
}

export async function uploadRendicionFile(params: {
  spaceId: string | number
  rendicionId: string | number
  categoria: string
  file: File
  name?: string
  documentoSubsanadoId?: number | string
}): Promise<RendicionDetail> {
  const formData = new FormData()
  formData.append('archivo', params.file)
  formData.append('categoria', params.categoria)
  if (params.name?.trim()) {
    formData.append('nombre', params.name.trim())
  }
  if (params.documentoSubsanadoId !== undefined && params.documentoSubsanadoId !== null) {
    formData.append('documento_subsanado_id', String(params.documentoSubsanadoId))
  }
  const { data } = await http.post<RendicionDetail>(
    `/comedores/${params.spaceId}/rendiciones/${params.rendicionId}/documentacion/`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    },
  )
  return data
}

export async function deleteRendicionFile(params: {
  spaceId: string | number
  rendicionId: string | number
  documentoId: string | number
}): Promise<RendicionDetail> {
  const { data } = await http.post<RendicionDetail>(
    `/comedores/${params.spaceId}/rendiciones/${params.rendicionId}/documentacion/${params.documentoId}/eliminar/`,
  )
  return data
}

export async function presentRendicion(
  spaceId: string | number,
  rendicionId: string | number,
): Promise<void> {
  await http.post(`/comedores/${spaceId}/rendiciones/${rendicionId}/presentar/`)
}

export async function deleteSpaceRendicion(
  spaceId: string | number,
  rendicionId: string | number,
): Promise<void> {
  await http.post(`/comedores/${spaceId}/rendiciones/${rendicionId}/eliminar/`)
}
