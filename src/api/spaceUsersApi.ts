import { http } from './http'

export interface SpaceUserItem {
  id: number
  username: string
  email: string
  creado_por_id: number | null
  creado_por_username: string | null
  permission_codes: string[]
  comedor_ids: number[]
  activo: boolean
  fecha_creacion: string
}

export interface AssignableSpaceUserSpace {
  id: number
  nombre: string
}

export interface SpaceUsersResponse {
  count: number
  num_pages: number
  current_page: number
  assignable_permission_codes: string[]
  assignable_comedores: AssignableSpaceUserSpace[]
  results: SpaceUserItem[]
}

export interface CreateSpaceUserPayload {
  username: string
  email: string
  password: string
  comedor_ids: number[]
  permission_codes: string[]
}

export async function listSpaceUsers(spaceId: string | number): Promise<SpaceUsersResponse> {
  const { data } = await http.get<SpaceUsersResponse>(`/comedores/${spaceId}/usuarios/`)
  return data
}

export async function createSpaceUser(
  spaceId: string | number,
  payload: CreateSpaceUserPayload,
): Promise<SpaceUserItem> {
  const { data } = await http.post<SpaceUserItem>(`/comedores/${spaceId}/usuarios/`, payload)
  return data
}

export async function updateSpaceUserPermissions(
  spaceId: string | number,
  userId: string | number,
  permissionCodes: string[],
): Promise<SpaceUserItem> {
  const { data } = await http.patch<SpaceUserItem>(
    `/comedores/${spaceId}/usuarios/${userId}/permisos/`,
    { permission_codes: permissionCodes },
  )
  return data
}

export async function deactivateSpaceUser(
  spaceId: string | number,
  userId: string | number,
): Promise<void> {
  await http.patch(`/comedores/${spaceId}/usuarios/${userId}/desactivar/`)
}
