import { http } from './http'

export const PRESTACION_TIPOS = ['desayuno', 'almuerzo', 'merienda', 'cena'] as const
export const PRESTACION_DIAS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const

export type PrestacionTipo = (typeof PRESTACION_TIPOS)[number]
export type PrestacionDia = (typeof PRESTACION_DIAS)[number]

export interface PrestacionConformidad {
  id: number
  periodo: string
  conforme: boolean
  observaciones: string
  creado: string
  usuario_id: number | null
  usuario_nombre: string | null
  informe_id: number | null
}

export interface PrestacionAlimentariaResponse {
  informe_id: number | null
  admision_id: number | null
  tipo: string | null
  estado_formulario: string | null
  creado: string | null
  modificado: string | null
  fecha_finalizacion: string | null
  periodo_actual: string
  periodo_pendiente?: string
  conformidad_pendiente?: boolean
  periodos_disponibles?: Array<{
    periodo: string
    label: string
    registrada: boolean
  }>
  conformidad_actual: PrestacionConformidad | null
  historial_conformidad: PrestacionConformidad[]
  [key: string]: number | string | boolean | null | PrestacionConformidad | PrestacionConformidad[] | Array<{
    periodo: string
    label: string
    registrada: boolean
  }> | undefined
}

export interface RegistrarConformidadPayload {
  periodo: string
  conforme: boolean
  observaciones?: string
}

export async function getPrestacionesConveniadas(
  spaceId: string | number,
): Promise<PrestacionAlimentariaResponse> {
  const { data } = await http.get<PrestacionAlimentariaResponse>(
    `/comedores/${spaceId}/prestacion-alimentaria/`,
    { timeout: 60000 },
  )
  return data
}

export async function registrarPrestacionConformidad(
  spaceId: string | number,
  payload: RegistrarConformidadPayload,
): Promise<PrestacionConformidad> {
  const { data } = await http.post<PrestacionConformidad>(
    `/comedores/${spaceId}/prestacion-alimentaria/conformidad/`,
    payload,
  )
  return data
}
