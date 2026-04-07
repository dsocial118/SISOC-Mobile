import { http } from './http'

export interface SpaceMessageAttachment {
  id: number
  nombre_original: string
  fecha_subida: string | null
  url: string | null
}

export interface SpaceMessageAction {
  tipo: 'rendicion_detalle'
  rendicion_id: number
}

export interface SpaceMessageItem {
  id: number
  titulo: string
  cuerpo: string
  accion: SpaceMessageAction | null
  destacado: boolean
  subtipo: string
  seccion: 'general' | 'espacio'
  fecha_creacion: string | null
  fecha_publicacion: string | null
  fecha_vencimiento: string | null
  visto: boolean
  fecha_visto: string | null
  adjuntos: SpaceMessageAttachment[]
}

export interface SpaceMessagesResponse {
  count: number
  num_pages: number
  current_page: number
  unread_count: number
  unread_grouped_count: number
  unread_general_count: number
  unread_espacio_count: number
  unread_general_ids: number[]
  unread_rendicion_ids: number[]
  unread_espacio_non_rendicion_count: number
  secciones: {
    generales: SpaceMessageItem[]
    espacios: SpaceMessageItem[]
  }
  results: SpaceMessageItem[]
}

export async function listSpaceMessages(
  spaceId: string | number,
): Promise<SpaceMessagesResponse> {
  const { data } = await http.get<SpaceMessagesResponse>(
    `/pwa/espacios/${spaceId}/mensajes/`,
    {
      timeout: 30000,
    },
  )
  return data
}

export async function markSpaceMessageAsSeen(
  spaceId: string | number,
  messageId: string | number,
): Promise<SpaceMessageItem> {
  const { data } = await http.patch<SpaceMessageItem>(
    `/pwa/espacios/${spaceId}/mensajes/${messageId}/marcar-visto/`,
    {},
  )
  return data
}

export async function getSpaceMessageDetail(
  spaceId: string | number,
  messageId: string | number,
): Promise<SpaceMessageItem> {
  const { data } = await http.get<SpaceMessageItem>(
    `/pwa/espacios/${spaceId}/mensajes/${messageId}/`,
  )
  return data
}
