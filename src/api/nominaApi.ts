import { http } from './http'

export type NominaTab = 'consolidada' | 'alimentaria' | 'formacion'

export interface NominaStats {
  total_nomina: number
  genero: {
    M: number
    F: number
    X: number
  }
  menores_edad: number
  mayores_edad: number
}

export interface NominaActividad {
  actividad_id: number
  categoria: string
  actividad: string
  dia: string
  horario: string
}

export interface NominaAttendanceRecord {
  id: number
  periodicidad: string
  periodo_referencia: string
  periodo_label: string
  fecha_toma_asistencia: string
  tomado_por: string | null
}

export interface NominaPerson {
  id: number
  nombre: string
  apellido: string
  dni: string
  genero: string
  fecha_nacimiento: string | null
  estado: string
  badges: string[]
  actividades: NominaActividad[]
  cantidad_actividades: number
  es_indocumentado: boolean
  identificador_interno: string | null
  asistencia_mes_actual: NominaAttendanceRecord | null
  historial_asistencias: NominaAttendanceRecord[]
  observaciones: string | null
}

export interface NominaResponse {
  tab: NominaTab
  stats: NominaStats
  results: NominaPerson[]
}

export interface NominaGender {
  id: number
  sexo: string
}

export interface NominaRenaperPreview {
  nombre: string
  apellido: string
  documento: string
  fecha_nacimiento: string | null
  sexo: string
}

export interface CreateNominaPayload {
  ciudadano_id?: number
  nombre?: string
  apellido?: string
  dni?: string
  sexo_id?: number
  fecha_nacimiento?: string
  es_indocumentado?: boolean
  identificador_interno?: string
  asistencia_alimentaria: boolean
  asistencia_actividades: boolean
  actividad_ids: number[]
  observaciones?: string
}

export interface BulkNominaAttendanceResponse {
  periodo_referencia: string
  periodo_label: string
  selected_nomina_ids: number[]
  created_count: number
  deleted_count: number
}

export async function listSpaceNomina(
  spaceId: string | number,
  options?: { tab?: NominaTab; q?: string },
): Promise<NominaResponse> {
  const { data } = await http.get<NominaResponse>(`/pwa/espacios/${spaceId}/nomina/`, {
    params: options,
  })
  return data
}

export async function listNominaGenders(spaceId: string | number): Promise<NominaGender[]> {
  const { data } = await http.get<NominaGender[]>(`/pwa/espacios/${spaceId}/nomina/generos/`)
  return data
}

export async function previewNominaDni(
  spaceId: string | number,
  dni: string,
): Promise<NominaRenaperPreview> {
  const { data } = await http.post<NominaRenaperPreview>(
    `/pwa/espacios/${spaceId}/nomina/preview-dni/`,
    { dni },
    { timeout: 60000 },
  )
  return data
}

export async function createNominaPerson(
  spaceId: string | number,
  payload: CreateNominaPayload,
): Promise<NominaPerson> {
  const { data } = await http.post<NominaPerson>(`/pwa/espacios/${spaceId}/nomina/`, payload, {
    timeout: 60000,
  })
  return data
}

export async function updateNominaPerson(
  spaceId: string | number,
  nominaId: string | number,
  payload: Partial<CreateNominaPayload>,
): Promise<NominaPerson> {
  const { data } = await http.patch<NominaPerson>(`/pwa/espacios/${spaceId}/nomina/${nominaId}/`, payload)
  return data
}

export async function getNominaPersonDetail(
  spaceId: string | number,
  nominaId: string | number,
): Promise<NominaPerson> {
  const { data } = await http.get<NominaPerson>(`/pwa/espacios/${spaceId}/nomina/${nominaId}/`)
  return data
}

export async function deleteNominaPerson(spaceId: string | number, nominaId: string | number): Promise<void> {
  await http.delete(`/pwa/espacios/${spaceId}/nomina/${nominaId}/`)
}

export async function registerNominaAttendance(
  spaceId: string | number,
  nominaId: string | number,
): Promise<{ created: boolean; registro: NominaAttendanceRecord }> {
  const { data } = await http.post<{ created: boolean; registro: NominaAttendanceRecord }>(
    `/pwa/espacios/${spaceId}/nomina/${nominaId}/registrar-asistencia/`,
  )
  return data
}

export async function listNominaAttendanceHistory(
  spaceId: string | number,
  nominaId: string | number,
): Promise<NominaAttendanceRecord[]> {
  const { data } = await http.get<NominaAttendanceRecord[]>(
    `/pwa/espacios/${spaceId}/nomina/${nominaId}/historial-asistencia/`,
  )
  return data
}

export async function syncNominaAlimentariaAttendance(
  spaceId: string | number,
  nominaIds: number[],
): Promise<BulkNominaAttendanceResponse> {
  const { data } = await http.post<BulkNominaAttendanceResponse>(
    `/pwa/espacios/${spaceId}/nomina/asistencia-alimentaria/`,
    { nomina_ids: nominaIds },
  )
  return data
}
