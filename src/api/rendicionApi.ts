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
  description?: string | null
  required: boolean
  multiple: boolean
  order: number
  modelo?: RendicionModeloItem | null
  archivos: RendicionFileItem[]
}

export interface RendicionModeloItem {
  codigo: string
  label: string
  filename: string
  order: number
  url: string
}

export interface RendicionItem {
  id: number | string
  proyecto?: number | null
  proyecto_codigo?: string | null
  convenio: string | null
  numero_rendicion: number | null
  mes: number
  anio: number
  periodo_inicio: string | null
  periodo_fin: string | null
  periodo_label: string
  linea_programatica?: 'secos' | 'tradicional' | string | null
  linea_programatica_label?: string | null
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
  modelos?: RendicionModeloItem[]
}

interface PaginatedResponse<T> {
  count: number
  num_pages: number
  current_page: number
  results: T[]
}

const inflightListRequests = new Map<string, Promise<PaginatedResponse<RendicionItem>>>()

export interface CreateRendicionPayload {
  proyecto_id?: number
  convenio: string
  numero_rendicion: number
  periodo_inicio: string
  periodo_fin: string
  linea_programatica?: 'secos' | 'tradicional' | string
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

function normalizeApiUrl(url: string): string {
  if (url.startsWith('/api/')) {
    return url.slice(4)
  }
  return url
}

export async function downloadRendicionModelo(modelo: RendicionModeloItem): Promise<void> {
  const { data } = await http.get<Blob>(normalizeApiUrl(modelo.url), {
    responseType: 'blob',
    timeout: 60000,
  })
  const objectUrl = window.URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = modelo.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}
