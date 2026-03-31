import axios, { type AxiosError } from 'axios'

function looksLikeHtmlDocument(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.startsWith('<!doctype html')
    || normalized.startsWith('<html')
    || normalized.startsWith('<')
  )
}

function extractFirstMessage(data: unknown): string | null {
  if (!data) {
    return null
  }

  if (typeof data === 'string') {
    const message = data.trim()
    if (!message || looksLikeHtmlDocument(message)) {
      return null
    }
    return message
  }

  if (typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === 'string') {
    const message = detail.trim()
    return message && !looksLikeHtmlDocument(message) ? message : null
  }

  if (detail && typeof detail === 'object') {
    const nested = extractFirstMessage(Object.values(detail as Record<string, unknown>)[0])
    if (nested) {
      return nested
    }
  }

  const firstEntry = Object.values(record)[0]
  if (Array.isArray(firstEntry) && firstEntry.length > 0) {
    return extractFirstMessage(firstEntry[0])
  }

  return extractFirstMessage(firstEntry)
}

export function parseApiError(
  error: unknown,
  fallback: string,
  options?: {
    timeoutMessage?: string
    htmlFallback?: string
  },
): string {
  const timeoutMessage = options?.timeoutMessage
  const htmlFallback = options?.htmlFallback || fallback

  if (axios.isAxiosError(error)) {
    if (
      (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      && timeoutMessage
    ) {
      return timeoutMessage
    }

    const data = (error as AxiosError<unknown>).response?.data
    const extractedMessage = extractFirstMessage(data)
    if (extractedMessage) {
      return extractedMessage
    }

    if (typeof data === 'string' && looksLikeHtmlDocument(data)) {
      return htmlFallback
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}
