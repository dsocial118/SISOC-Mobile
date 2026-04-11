import { http } from './http'

export interface SpaceImageItem {
  id: number
  url: string | null
}

export interface SpaceItem {
  id: number
  nombre: string
  organizacion_id?: number | null
  organizacion__nombre?: string | null
  programa_id?: number | null
  programa__nombre?: string | null
  codigo_de_proyecto?: string | null
  ultimo_estado__estado_general__estado_actividad__estado?: string | null
  ultimo_estado__estado_general__estado_proceso?: string | number | null
  ultimo_estado__estado_general__estado_proceso__estado?: string | null
  ultimo_estado__estado_general__estado_detalle?: string | number | null
  ultimo_estado__estado_general__estado_detalle__estado?: string | null
  provincia__nombre?: string | null
  localidad__nombre?: string | null
  tipo_asociacion?: 'organizacion' | 'espacio' | null
  calle?: string | null
  numero?: number | null
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface OrganizationDetail {
  id: number
  nombre?: string | null
  cuit?: string | null
  telefono?: string | null
  email?: string | null
  domicilio?: string | null
  partido?: string | null
  provincia?: { id: number; nombre: string } | null
  municipio?: { id: number; nombre: string } | null
  localidad?: { id: number; nombre: string } | null
}

export interface SpaceReferenteDetail {
  id: number
  nombre?: string | null
  apellido?: string | null
  mail?: string | null
  celular?: string | null
  documento?: string | number | null
  funcion?: string | null
}

export interface SpaceDetail {
  id: number
  nombre: string
  codigo_de_proyecto?: string | null
  comienzo?: string | number | null
  estado?: string | null
  calle?: string | null
  numero?: number | null
  piso?: string | null
  departamento?: string | null
  manzana?: string | null
  lote?: string | null
  entre_calle_1?: string | null
  entre_calle_2?: string | null
  latitud?: number | null
  longitud?: number | null
  partido?: string | null
  barrio?: string | null
  codigo_postal?: string | null
  provincia?: { id: number; nombre: string } | null
  municipio?: { id: number; nombre: string } | null
  localidad?: { id: number; nombre: string } | null
  organizacion?: OrganizationDetail | null
  programa?: { id: number; nombre: string } | null
  referente?: SpaceReferenteDetail | null
  imagenes?: SpaceImageItem[]
  ultimo_estado?: {
    estado_actividad?: string | null
    estado_proceso?: string | null
    estado_detalle?: string | null
  } | null
  relevamiento_actual_mobile?: {
    fecha_visita?: string | null
    estado?: string | null
    items: Array<{
      pregunta: string
      respuesta: string
    }>
    sections?: Array<{
      titulo: string
      items: Array<{
        pregunta: string
        respuesta: string
      }>
    }>
  } | null
}

const spaceDetailCache = new Map<string, SpaceDetail>()

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  if (!value || typeof value !== 'object') {
    return false
  }
  return Array.isArray((value as PaginatedResponse<T>).results)
}

export async function listMySpaces(): Promise<SpaceItem[]> {
  let url: string | null = '/comedores/'
  const allSpaces: SpaceItem[] = []

  while (url) {
    const payloadUnknown: unknown = (await http.get(url)).data
    const payload: PaginatedResponse<SpaceItem> | SpaceItem[] =
      payloadUnknown as PaginatedResponse<SpaceItem> | SpaceItem[]
    if (Array.isArray(payload)) {
      allSpaces.push(...payload)
      break
    }
    if (isPaginatedResponse<SpaceItem>(payload)) {
      allSpaces.push(...payload.results)
      url = payload.next
      continue
    }
    break
  }

  return allSpaces
}

export async function getSpaceDetail(
  spaceId: string | number,
  options?: { forceRefresh?: boolean },
): Promise<SpaceDetail> {
  const cacheKey = String(spaceId)
  const cached = spaceDetailCache.get(cacheKey)
  if (cached && !options?.forceRefresh) {
    return cached
  }

  const { data } = await http.get<SpaceDetail>(`/comedores/${spaceId}/`, {
    timeout: 60000,
  })
  spaceDetailCache.set(cacheKey, data)
  return data
}

export async function uploadSpaceImage(
  spaceId: string | number,
  file: File,
): Promise<SpaceImageItem[]> {
  const formData = new FormData()
  formData.append('imagen', file)

  const { data } = await http.post<{ imagenes: SpaceImageItem[] }>(
    `/comedores/${spaceId}/imagenes/`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    },
  )

  const cacheKey = String(spaceId)
  const cached = spaceDetailCache.get(cacheKey)
  if (cached) {
    spaceDetailCache.set(cacheKey, {
      ...cached,
      imagenes: data.imagenes,
    })
  }

  return data.imagenes
}

export async function deleteSpaceImage(
  spaceId: string | number,
  imageId: string | number,
): Promise<SpaceImageItem[]> {
  const { data } = await http.post<{ imagenes: SpaceImageItem[] }>(
    `/comedores/${spaceId}/imagenes/${imageId}/eliminar/`,
  )

  const cacheKey = String(spaceId)
  const cached = spaceDetailCache.get(cacheKey)
  if (cached) {
    spaceDetailCache.set(cacheKey, {
      ...cached,
      imagenes: data.imagenes,
    })
  }

  return data.imagenes
}
