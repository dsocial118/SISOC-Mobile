import type { SpaceItem } from '../../api/spacesApi'

const cacheByUsername: Record<string, SpaceItem[] | undefined> = {}
const STORAGE_KEY_PREFIX = 'sisoc:org-spaces:'

function readSpacesFromStorage(username: string): SpaceItem[] | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${username}`)
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as SpaceItem[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeSpacesToStorage(username: string, spaces: SpaceItem[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${username}`, JSON.stringify(spaces))
}

export function getOrganizationSpacesCache(username: string): SpaceItem[] | null {
  const inMemory = cacheByUsername[username]
  if (inMemory) {
    return inMemory
  }

  const stored = readSpacesFromStorage(username)
  if (stored) {
    cacheByUsername[username] = stored
    return stored
  }

  return null
}

export function setOrganizationSpacesCache(username: string, spaces: SpaceItem[]): void {
  cacheByUsername[username] = spaces
  writeSpacesToStorage(username, spaces)
}

export function clearOrganizationSpacesCache(): void {
  for (const key of Object.keys(cacheByUsername)) {
    delete cacheByUsername[key]
  }
  if (typeof window !== 'undefined') {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith(STORAGE_KEY_PREFIX))
      .forEach((key) => window.sessionStorage.removeItem(key))
  }
}
