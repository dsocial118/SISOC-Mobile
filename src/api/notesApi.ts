import { http } from './http'

export interface CreateNotePayload {
  id: string
  name: string
  note: string
  photo_data_url?: string
  lat?: number
  lng?: number
}

export async function createRemoteNote(params: {
  payload: CreateNotePayload
  client_uuid: string
}): Promise<void> {
  await http.post('/notes/', params.payload, {
    headers: {
      'Idempotency-Key': params.client_uuid,
      'X-Client-UUID': params.client_uuid,
    },
  })
}
