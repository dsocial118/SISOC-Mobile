import { http } from './http'
import axios from 'axios'

export interface SpaceImageItem {
  id: number
  url: string | null
  origen?: 'web' | 'mobile' | string
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
  datos_convenio_mobile?: {
    tipo?: 'pnud' | 'alimentar_comunidad' | 'otro' | string
    vigencia_convenio_meses?: number | null
    prestaciones_mensuales?: number | null
    monto_prestacion_mensual?: number | null
    prestaciones_gescom_total_mensual?: number | null
    monto_total_convenio?: number | null
    organizacion_solicitante?: string | null
    codigo_proyecto?: string | null
    monto_total_conveniado?: number | null
    nro_convenio?: string | null
    estado_general?: string | null
    subestado?: string | null
    nombre_espacio_comunitario?: string | null
    id_externo?: string | number | null
    domicilio_completo_espacio?: string | null
    monto_total_convenio_por_espacio?: number | null
    prestaciones_financiadas_mensuales?: number | null
    personas_conveniadas?: number | null
    cantidad_modulos?: number | null
  } | null
  _source?: 'network' | 'cache'
}

const spaceDetailCache = new Map<string, SpaceDetail>()
const inFlightSpaceDetail = new Map<string, Promise<SpaceDetail>>()
const SPACE_DETAIL_STORAGE_PREFIX = 'sisoc:space-detail:'

function readSpaceDetailFromStorage(spaceId: string | number): SpaceDetail | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(`${SPACE_DETAIL_STORAGE_PREFIX}${spaceId}`)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as SpaceDetail
  } catch {
    return null
  }
}

function writeSpaceDetailToStorage(spaceId: string | number, detail: SpaceDetail): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.sessionStorage.setItem(
      `${SPACE_DETAIL_STORAGE_PREFIX}${spaceId}`,
      JSON.stringify(detail),
    )
  } catch {
    // no-op
  }
}

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  if (!value || typeof value !== 'object') {
    return false
  }
  return Array.isArray((value as PaginatedResponse<T>).results)
}

export async function listMySpaces(): Promise<SpaceItem[]> {
  async function fetchSpacesWithTimeout(timeout: number): Promise<SpaceItem[]> {
    let url: string | null = '/comedores/'
    const allSpaces: SpaceItem[] = []

    while (url) {
      const payloadUnknown: unknown = (await http.get(url, { timeout })).data
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

  function isTimeoutError(error: unknown): boolean {
    return axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
  }

  try {
    return await fetchSpacesWithTimeout(15000)
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error
    }
  }

  try {
    return await fetchSpacesWithTimeout(30000)
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error
    }
  }

  return await fetchSpacesWithTimeout(60000)
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
  const running = inFlightSpaceDetail.get(cacheKey)
  if (running && !options?.forceRefresh) {
    return running
  }

  async function fetchWithTimeout(timeout: number): Promise<SpaceDetail> {
    const { data } = await http.get<SpaceDetail>(`/comedores/${spaceId}/`, {
      timeout,
    })
    const withSource: SpaceDetail = {
      ...data,
      _source: 'network',
    }
    spaceDetailCache.set(cacheKey, withSource)
    writeSpaceDetailToStorage(spaceId, withSource)
    return withSource
  }

  function isTimeoutError(error: unknown): boolean {
    return axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
  }

  const request = (async () => {
    try {
      return await fetchWithTimeout(12000)
    } catch (error) {
      if (isTimeoutError(error)) {
        try {
          return await fetchWithTimeout(25000)
        } catch (retryError) {
          if (isTimeoutError(retryError)) {
            try {
              return await fetchWithTimeout(60000)
            } catch (lastRetryError) {
              const persisted = readSpaceDetailFromStorage(spaceId)
              if (persisted) {
                const withSource: SpaceDetail = {
                  ...persisted,
                  _source: 'cache',
                }
                spaceDetailCache.set(cacheKey, withSource)
                return withSource
              }
              throw lastRetryError
            }
          }

          const persisted = readSpaceDetailFromStorage(spaceId)
          if (persisted) {
            const withSource: SpaceDetail = {
              ...persisted,
              _source: 'cache',
            }
            spaceDetailCache.set(cacheKey, withSource)
            return withSource
          }
          throw retryError
        }
      }

      const persisted = readSpaceDetailFromStorage(spaceId)
      if (persisted) {
        const withSource: SpaceDetail = {
          ...persisted,
          _source: 'cache',
        }
        spaceDetailCache.set(cacheKey, withSource)
        return withSource
      }
      throw error
    }
  })()

  inFlightSpaceDetail.set(cacheKey, request)
  try {
    return await request
  } finally {
    if (inFlightSpaceDetail.get(cacheKey) === request) {
      inFlightSpaceDetail.delete(cacheKey)
    }
  }
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
