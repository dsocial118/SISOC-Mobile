import type { SpaceItem } from '../../api/spacesApi'

const cacheByUsername: Record<string, SpaceItem[] | undefined> = {}

export function getOrganizationSpacesCache(username: string): SpaceItem[] | null {
  return cacheByUsername[username] ?? null
}

export function setOrganizationSpacesCache(username: string, spaces: SpaceItem[]): void {
  cacheByUsername[username] = spaces
}

export function clearOrganizationSpacesCache(): void {
  for (const key of Object.keys(cacheByUsername)) {
    delete cacheByUsername[key]
  }
}

