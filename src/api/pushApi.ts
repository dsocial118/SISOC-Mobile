import { http } from './http'

export interface PushConfigResponse {
  enabled: boolean
  public_key: string
}

export interface PushSubscriptionPayload {
  endpoint: string
  p256dh: string
  auth: string
  content_encoding?: string
}

export async function getPushConfig(): Promise<PushConfigResponse> {
  const { data } = await http.get<PushConfigResponse>('/pwa/push/config/')
  return data
}

export async function savePushSubscription(
  payload: PushSubscriptionPayload,
): Promise<void> {
  await http.post('/pwa/push/subscriptions/', payload)
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await http.delete('/pwa/push/subscriptions/', {
    data: { endpoint },
  })
}
