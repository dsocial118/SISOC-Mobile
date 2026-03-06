import { http } from './http'

export interface SpaceCollaborator {
  id: number
  comedor: number
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  rol_funcion: string
  activo: boolean
  fecha_creacion: string
  fecha_actualizacion: string
  fecha_baja: string | null
}

export interface SpaceCollaboratorPayload {
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  rol_funcion: string
}

export async function listSpaceCollaborators(
  spaceId: string | number,
): Promise<SpaceCollaborator[]> {
  const { data } = await http.get<SpaceCollaborator[]>(
    `/pwa/espacios/${spaceId}/colaboradores/`,
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
