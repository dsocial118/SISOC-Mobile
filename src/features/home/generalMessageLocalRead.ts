const STORAGE_PREFIX = 'sisoc:general-message-read:'

function buildStorageKey(username: string | null | undefined, spaceId: string | number): string {
  const userKey = (username || '__anonymous__').trim() || '__anonymous__'
  return `${STORAGE_PREFIX}${userKey}:${spaceId}`
}

function readIds(username: string | null | undefined, spaceId: string | number): Set<number> {
  if (typeof window === 'undefined') {
    return new Set<number>()
  }
  try {
    const raw = window.localStorage.getItem(buildStorageKey(username, spaceId))
    if (!raw) {
      return new Set<number>()
    }
    const parsed = JSON.parse(raw) as number[]
    return new Set((Array.isArray(parsed) ? parsed : []).map((value) => Number(value)).filter(Boolean))
  } catch {
    return new Set<number>()
  }
}

function writeIds(username: string | null | undefined, spaceId: string | number, ids: Set<number>): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(buildStorageKey(username, spaceId), JSON.stringify(Array.from(ids.values())))
  } catch {
    // no-op
  }
}

export function isGeneralMessageReadInSpace(
  username: string | null | undefined,
  spaceId: string | number,
  messageId: number,
): boolean {
  if (!messageId) {
    return false
  }
  return readIds(username, spaceId).has(messageId)
}

export function markGeneralMessageReadInSpace(
  username: string | null | undefined,
  spaceId: string | number,
  messageId: number,
): void {
  if (!messageId) {
    return
  }
  const ids = readIds(username, spaceId)
  ids.add(messageId)
  writeIds(username, spaceId, ids)
}
