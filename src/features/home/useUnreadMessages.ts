import { useEffect, useMemo, useState } from 'react'
import { listSpaceMessages } from '../../api/messagesApi'
import { listMySpaces, type SpaceItem } from '../../api/spacesApi'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'

const SPACE_UNREAD_MESSAGES_EVENT = 'sisoc:space-unread-messages-updated'
const unreadMessagesCacheBySpaceId: Record<string, number | undefined> = {}
const STORAGE_KEY_PREFIX = 'sisoc:unread-messages:'

interface SpaceUnreadMessagesDetail {
  spaceId: string
  unreadCount: number
}

interface UnreadMessagesState {
  unreadCount: number
  firstUnreadSpaceId: number | null
}

const UNREAD_BATCH_SIZE = 4

function readUnreadCountsFromStorage(cacheKey: string): Record<string, number> {
  if (typeof window === 'undefined') {
    return {}
  }

  const rawValue = window.sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${cacheKey}`)
  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, number>
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([spaceId, unreadCount]) => [
        spaceId,
        Number(unreadCount) || 0,
      ]),
    )
  } catch {
    return {}
  }
}

function writeUnreadCountsToStorage(
  cacheKey: string,
  unreadBySpaceId: Record<string, number>,
): void {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(
    `${STORAGE_KEY_PREFIX}${cacheKey}`,
    JSON.stringify(unreadBySpaceId),
  )
}

function syncInMemoryCache(unreadBySpaceId: Record<string, number>): void {
  Object.entries(unreadBySpaceId).forEach(([spaceId, unreadCount]) => {
    unreadMessagesCacheBySpaceId[spaceId] = unreadCount
  })
}

export function notifySpaceUnreadMessagesUpdated(
  spaceId: string | number,
  unreadCount: number,
) {
  unreadMessagesCacheBySpaceId[String(spaceId)] = unreadCount
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(
    new CustomEvent<SpaceUnreadMessagesDetail>(SPACE_UNREAD_MESSAGES_EVENT, {
      detail: {
        spaceId: String(spaceId),
        unreadCount,
      },
    }),
  )
}

function buildStateFromMap(
  orderedSpaceIds: number[],
  unreadBySpaceId: Record<string, number>,
): UnreadMessagesState {
  let total = 0
  let firstUnreadSpaceId: number | null = null

  for (const spaceId of orderedSpaceIds) {
    const count = unreadBySpaceId[String(spaceId)] || 0
    total += count
    if (firstUnreadSpaceId === null && count > 0) {
      firstUnreadSpaceId = spaceId
    }
  }

  return {
    unreadCount: total,
    firstUnreadSpaceId,
  }
}

function getCachedUnreadCount(
  spaceId?: string | number | null,
  username?: string | null,
): number {
  if (!spaceId) {
    return 0
  }

  const cacheKey = (username || '__anonymous__').trim() || '__anonymous__'
  const inMemoryUnreadCount = unreadMessagesCacheBySpaceId[String(spaceId)]
  if (inMemoryUnreadCount !== undefined) {
    return inMemoryUnreadCount
  }

  const storedUnreadCounts = readUnreadCountsFromStorage(cacheKey)
  const storedUnreadCount = storedUnreadCounts[String(spaceId)] || 0
  if (storedUnreadCount > 0) {
    unreadMessagesCacheBySpaceId[String(spaceId)] = storedUnreadCount
  }
  return storedUnreadCount
}

export function useSpaceUnreadMessages(
  spaceId?: string | number | null,
  username?: string | null,
) {
  const [unreadCount, setUnreadCount] = useState(() => getCachedUnreadCount(spaceId, username))

  useEffect(() => {
    let isMounted = true

    async function loadUnreadCount() {
      if (!spaceId) {
        setUnreadCount(0)
        return
      }

      setUnreadCount(getCachedUnreadCount(spaceId, username))

      try {
        const response = await listSpaceMessages(spaceId)
        if (!isMounted) {
          return
        }
        unreadMessagesCacheBySpaceId[String(spaceId)] = response.unread_count
        setUnreadCount(response.unread_count)
      } catch {
        if (isMounted) {
          setUnreadCount(getCachedUnreadCount(spaceId, username))
        }
      }
    }

    void loadUnreadCount()

    function handleUnreadEvent(event: Event) {
      const customEvent = event as CustomEvent<SpaceUnreadMessagesDetail>
      if (String(customEvent.detail?.spaceId || '') !== String(spaceId)) {
        return
      }
      setUnreadCount(customEvent.detail?.unreadCount || 0)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(SPACE_UNREAD_MESSAGES_EVENT, handleUnreadEvent)
    }

    return () => {
      isMounted = false
      if (typeof window !== 'undefined') {
        window.removeEventListener(SPACE_UNREAD_MESSAGES_EVENT, handleUnreadEvent)
      }
    }
  }, [spaceId, username])

  return unreadCount
}

export function useOrganizationUnreadMessages(username?: string | null) {
  const cacheKey = (username || '__anonymous__').trim() || '__anonymous__'
  const [spaces, setSpaces] = useState<SpaceItem[]>(() => getOrganizationSpacesCache(cacheKey) ?? [])
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [organizationUnreadCount, setOrganizationUnreadCount] = useState(0)
  const [unreadBySpaceId, setUnreadBySpaceId] = useState<Record<string, number>>(() => {
    const storedUnreadCounts = readUnreadCountsFromStorage(cacheKey)
    syncInMemoryCache(storedUnreadCounts)

    return {
      ...storedUnreadCounts,
      ...Object.fromEntries(
        Object.entries(unreadMessagesCacheBySpaceId).map(([spaceId, unreadCount]) => [
          spaceId,
          unreadCount || 0,
        ]),
      ),
    }
  })

  useEffect(() => {
    let isMounted = true

    async function ensureSpacesLoaded() {
      const cached = getOrganizationSpacesCache(cacheKey)
      if (cached) {
        setSpaces(cached)
        return
      }

      try {
        const loadedSpaces = await listMySpaces()
        if (!isMounted) {
          return
        }
        setOrganizationSpacesCache(cacheKey, loadedSpaces)
        setSpaces(loadedSpaces)
      } catch {
        if (isMounted) {
          setSpaces([])
        }
      }
    }

    void ensureSpacesLoaded()
    return () => {
      isMounted = false
    }
  }, [cacheKey])

  useEffect(() => {
    let isMounted = true

    async function loadUnreadCounts() {
      if (spaces.length === 0) {
        setUnreadBySpaceId({})
        setOrganizationUnreadCount(0)
        return
      }

      try {
        const results: Array<{
          spaceId: string
          unreadCount: number
          unreadGeneralIds: number[]
          unreadRendicionIds: number[]
          unreadEspacioNonRendicionCount: number
          unreadMessages: Awaited<ReturnType<typeof listSpaceMessages>>['results']
        }> = []

        for (let start = 0; start < spaces.length; start += UNREAD_BATCH_SIZE) {
          const batch = spaces.slice(start, start + UNREAD_BATCH_SIZE)
          const batchResults = await Promise.all(
            batch.map(async (space) => {
              try {
                const response = await listSpaceMessages(space.id)
                return {
                  spaceId: String(space.id),
                  unreadCount: response.unread_count,
                  unreadGeneralIds: response.unread_general_ids || [],
                  unreadRendicionIds: response.unread_rendicion_ids || [],
                  unreadEspacioNonRendicionCount:
                    response.unread_espacio_non_rendicion_count ?? 0,
                  unreadMessages: response.results.filter((message) => !message.visto),
                }
              } catch {
                return {
                  spaceId: String(space.id),
                  unreadCount: 0,
                  unreadGeneralIds: [],
                  unreadRendicionIds: [],
                  unreadEspacioNonRendicionCount: 0,
                  unreadMessages: [],
                }
              }
            }),
          )
          if (!isMounted) {
            return
          }
          results.push(...batchResults)
        }
        if (!isMounted) {
          return
        }
        const nextUnreadBySpaceId = Object.fromEntries(
          results.map((item) => [item.spaceId, item.unreadCount]),
        )
        const seenGeneralMessageIds = new Set<number>()
        const seenRendicionIds = new Set<number>()
        let nextOrganizationUnreadCount = 0
        results.forEach((item) => {
          const hasGroupedFields =
            item.unreadGeneralIds.length > 0
            || item.unreadRendicionIds.length > 0
            || item.unreadEspacioNonRendicionCount > 0

          if (hasGroupedFields) {
            item.unreadGeneralIds.forEach((messageId) => {
              if (seenGeneralMessageIds.has(messageId)) {
                return
              }
              seenGeneralMessageIds.add(messageId)
              nextOrganizationUnreadCount += 1
            })
            item.unreadRendicionIds.forEach((rendicionId) => {
              if (seenRendicionIds.has(rendicionId)) {
                return
              }
              seenRendicionIds.add(rendicionId)
              nextOrganizationUnreadCount += 1
            })
            nextOrganizationUnreadCount += item.unreadEspacioNonRendicionCount
            return
          }

          item.unreadMessages.forEach((message) => {
            if (message.seccion === 'general') {
              if (seenGeneralMessageIds.has(message.id)) {
                return
              }
              seenGeneralMessageIds.add(message.id)
              nextOrganizationUnreadCount += 1
              return
            }

            if (
              message.seccion === 'espacio' &&
              message.accion?.tipo === 'rendicion_detalle' &&
              message.accion.rendicion_id
            ) {
              if (seenRendicionIds.has(message.accion.rendicion_id)) {
                return
              }
              seenRendicionIds.add(message.accion.rendicion_id)
              nextOrganizationUnreadCount += 1
              return
            }

            nextOrganizationUnreadCount += 1
          })
        })
        syncInMemoryCache(nextUnreadBySpaceId)
        writeUnreadCountsToStorage(cacheKey, nextUnreadBySpaceId)
        setUnreadBySpaceId(nextUnreadBySpaceId)
        setOrganizationUnreadCount(nextOrganizationUnreadCount)
      } catch {
        if (isMounted) {
          setUnreadBySpaceId({})
          setOrganizationUnreadCount(0)
        }
      }
    }

    void loadUnreadCounts()
    return () => {
      isMounted = false
    }
  }, [cacheKey, refreshVersion, spaces])

  useEffect(() => {
    function handleUnreadEvent(event: Event) {
      const customEvent = event as CustomEvent<SpaceUnreadMessagesDetail>
      const targetSpaceId = String(customEvent.detail?.spaceId || '')
      if (!targetSpaceId) {
        return
      }
      setUnreadBySpaceId((current) => {
        const nextState = {
          ...current,
          [targetSpaceId]: customEvent.detail?.unreadCount || 0,
        }
        writeUnreadCountsToStorage(cacheKey, nextState)
        return nextState
      })
      setRefreshVersion((current) => current + 1)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(SPACE_UNREAD_MESSAGES_EVENT, handleUnreadEvent)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SPACE_UNREAD_MESSAGES_EVENT, handleUnreadEvent)
      }
    }
  }, [cacheKey])

  return useMemo(
    () =>
      ({
        ...buildStateFromMap(
          spaces.map((space) => space.id),
          unreadBySpaceId,
        ),
        unreadCount: organizationUnreadCount,
      }),
    [organizationUnreadCount, spaces, unreadBySpaceId],
  )
}
