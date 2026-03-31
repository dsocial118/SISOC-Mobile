import type { RendicionDetail, RendicionItem } from '../../api/rendicionApi'
import type { RendicionProjectContext } from './rendicionContext'

export interface RendicionContextListItemCache {
  context: RendicionProjectContext
  rendiciones: RendicionItem[]
}

interface RendicionHubCacheEntry {
  items: RendicionContextListItemCache[]
  selectedOrganizationId: string
  selectedProjectKey: string
}

const rendicionHubCache = new Map<string, RendicionHubCacheEntry>()
const rendicionListCache = new Map<string, RendicionItem[]>()
const rendicionDetailCache = new Map<string, RendicionDetail>()

export function getRendicionHubCache(cacheKey: string): RendicionHubCacheEntry | null {
  return rendicionHubCache.get(cacheKey) ?? null
}

export function setRendicionHubCache(cacheKey: string, value: RendicionHubCacheEntry): void {
  rendicionHubCache.set(cacheKey, value)
}

export function getRendicionListCache(spaceId: string): RendicionItem[] | null {
  return rendicionListCache.get(spaceId) ?? null
}

export function setRendicionListCache(spaceId: string, value: RendicionItem[]): void {
  rendicionListCache.set(spaceId, value)
}

export function getRendicionDetailCache(cacheKey: string): RendicionDetail | null {
  return rendicionDetailCache.get(cacheKey) ?? null
}

export function setRendicionDetailCache(cacheKey: string, value: RendicionDetail): void {
  rendicionDetailCache.set(cacheKey, value)
}
