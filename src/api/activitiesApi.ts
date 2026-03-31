import { http } from './http'

export interface ActivityCatalogItem {
  id: number
  categoria: string
  actividad: string
}

export interface ActivityDayItem {
  id: number
  nombre: string
}

export interface SpaceActivityItem {
  id: number
  comedor: number
  catalogo_actividad: number
  categoria: string
  actividad: string
  dia_actividad: number
  dia_actividad_nombre: string
  hora_inicio: string | null
  hora_fin: string | null
  horario_actividad: string
  cantidad_inscriptos: number
  activo: boolean
  fecha_alta: string
  fecha_actualizacion: string
  fecha_baja: string | null
}

export interface SpaceActivityPayload {
  catalogo_actividad: number
  dia_actividad: number
  hora_inicio: string
  hora_fin: string
}

export interface SpaceActivityEnrollee {
  id: number
  nomina: number
  nombre: string
  apellido: string
  dni: string
  genero: string
  fecha_nacimiento: string | null
}

export async function listActivityCatalog(spaceId: string | number): Promise<ActivityCatalogItem[]> {
  const { data } = await http.get<ActivityCatalogItem[]>(
    `/pwa/espacios/${spaceId}/actividades/catalogo/`,
  )
  return data
}

export async function listActivityDays(spaceId: string | number): Promise<ActivityDayItem[]> {
  const { data } = await http.get<ActivityDayItem[]>(
    `/pwa/espacios/${spaceId}/actividades/dias/`,
  )
  return data
}

export async function listSpaceActivities(spaceId: string | number): Promise<SpaceActivityItem[]> {
  const { data } = await http.get<SpaceActivityItem[]>(
    `/pwa/espacios/${spaceId}/actividades/`,
  )
  return data
}

export async function createSpaceActivity(
  spaceId: string | number,
  payload: SpaceActivityPayload,
): Promise<SpaceActivityItem> {
  const { data } = await http.post<SpaceActivityItem>(
    `/pwa/espacios/${spaceId}/actividades/`,
    payload,
  )
  return data
}

export async function updateSpaceActivity(
  spaceId: string | number,
  activityId: string | number,
  payload: Partial<SpaceActivityPayload>,
): Promise<SpaceActivityItem> {
  const { data } = await http.patch<SpaceActivityItem>(
    `/pwa/espacios/${spaceId}/actividades/${activityId}/`,
    payload,
  )
  return data
}

export async function deleteSpaceActivity(spaceId: string | number, activityId: string | number): Promise<void> {
  await http.delete(`/pwa/espacios/${spaceId}/actividades/${activityId}/`)
}

export async function listActivityEnrollees(
  spaceId: string | number,
  activityId: string | number,
): Promise<SpaceActivityEnrollee[]> {
  const { data } = await http.get<SpaceActivityEnrollee[]>(
    `/pwa/espacios/${spaceId}/actividades/${activityId}/inscriptos/`,
  )
  return data
}
