import { http } from './http'

export interface SpaceCollaboratorActivity {
  id: number
  alias: string
  nombre: string
}

export interface SpaceCollaborator {
  id: number
  comedor: number
  ciudadano_id: number
  nombre: string
  apellido: string
  dni: string
  prefijo_cuil: string | null
  cuil_cuit: string | null
  sufijo_cuil: string | null
  sexo: string | null
  genero: string
  fecha_nacimiento: string | null
  edad: number | null
  codigo_telefono: string | null
  numero_telefono: string | null
  fecha_alta: string
  actividades: SpaceCollaboratorActivity[]
  activo: boolean
  fecha_creado: string
  fecha_modificado: string
  fecha_baja: string | null
}

export interface CollaboratorPreview {
  source: 'sisoc' | 'renaper'
  ciudadano_id: number | null
  ya_registrado_en_espacio: boolean
  colaborador_activo_id: number | null
  apellido: string
  nombre: string
  dni: string
  prefijo_cuil: string | null
  cuil_cuit: string | null
  sufijo_cuil: string | null
  sexo: string | null
  fecha_nacimiento: string | null
  edad: number | null
}

export interface CollaboratorGenderOption {
  id: string
  label: string
}

export interface SpaceCollaboratorPayload {
  ciudadano_id?: number
  dni?: string
  genero: string
  codigo_telefono: string
  numero_telefono: string
  fecha_alta: string
  fecha_baja?: string | null
  actividad_ids: number[]
}

export async function listSpaceCollaborators(
  spaceId: string | number,
): Promise<SpaceCollaborator[]> {
  const { data } = await http.get<SpaceCollaborator[]>(
    `/pwa/espacios/${spaceId}/colaboradores/`,
  )
  return data
}

export async function listCollaboratorGenders(
  spaceId: string | number,
): Promise<CollaboratorGenderOption[]> {
  const { data } = await http.get<CollaboratorGenderOption[]>(
    `/pwa/espacios/${spaceId}/colaboradores/generos/`,
  )
  return data
}

export async function listCollaboratorActivities(
  spaceId: string | number,
): Promise<SpaceCollaboratorActivity[]> {
  const { data } = await http.get<SpaceCollaboratorActivity[]>(
    `/pwa/espacios/${spaceId}/colaboradores/actividades/`,
  )
  return data
}

export async function previewSpaceCollaboratorDni(
  spaceId: string | number,
  dni: string,
): Promise<CollaboratorPreview> {
  const { data } = await http.post<CollaboratorPreview>(
    `/pwa/espacios/${spaceId}/colaboradores/preview-dni/`,
    { dni },
    { timeout: 60000 },
  )
  return data
}

export async function createSpaceCollaborator(
  spaceId: string | number,
  payload: SpaceCollaboratorPayload,
): Promise<SpaceCollaborator> {
  const { data } = await http.post<SpaceCollaborator>(
    `/pwa/espacios/${spaceId}/colaboradores/`,
    payload,
  )
  return data
}

export async function updateSpaceCollaborator(
  spaceId: string | number,
  collaboratorId: string | number,
  payload: Partial<SpaceCollaboratorPayload>,
): Promise<SpaceCollaborator> {
  const { data } = await http.patch<SpaceCollaborator>(
    `/pwa/espacios/${spaceId}/colaboradores/${collaboratorId}/`,
    payload,
  )
  return data
}

export async function deleteSpaceCollaborator(
  spaceId: string | number,
  collaboratorId: string | number,
): Promise<void> {
  await http.delete(`/pwa/espacios/${spaceId}/colaboradores/${collaboratorId}/`)
}
