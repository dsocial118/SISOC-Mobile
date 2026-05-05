import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import {
  listSpaceMessages,
  markSpaceMessageAsSeen,
  type SpaceMessageItem,
} from '../../api/messagesApi'
import { listMySpaces } from '../../api/spacesApi'
import { parseApiError } from '../../api/errorUtils'
import { useAuth } from '../../auth/useAuth'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { notifySpaceUnreadMessagesUpdated } from './useUnreadMessages'

interface AggregatedMessageItem {
  spaceId: number
  spaceName: string
  message: SpaceMessageItem
}

interface GroupedAggregatedMessageItem {
  groupKey: string
  spaceId: number
  spaceName: string
  message: SpaceMessageItem
  groupedItems: AggregatedMessageItem[]
  groupedCount: number
  unreadCount: number
}

const MESSAGE_BATCH_SIZE = 4

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Sin fecha'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha'
  }
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getMessageContextLabel(
  message: AggregatedMessageItem['message'],
  spaceName: string,
): string {
  if (message.seccion === 'general') {
    return 'General'
  }
  return spaceName
}

function groupOrganizationMessages(
  messages: AggregatedMessageItem[],
): GroupedAggregatedMessageItem[] {
  const grouped = new Map<string, GroupedAggregatedMessageItem>()

  messages.forEach((item) => {
    const groupKey = `space:${item.spaceId}:message:${item.message.id}`
    const existing = grouped.get(groupKey)

    if (!existing) {
      grouped.set(groupKey, {
        groupKey,
        spaceId: item.spaceId,
        spaceName: item.spaceName,
        message: item.message,
        groupedItems: [item],
        groupedCount: 1,
        unreadCount: item.message.visto ? 0 : 1,
      })
      return
    }

    existing.groupedItems.push(item)
    existing.groupedCount += 1
    existing.unreadCount += item.message.visto ? 0 : 1
  })

  return Array.from(grouped.values())
}

export function OrganizationMessagesPage() {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const cacheKey = userProfile?.username || '__anonymous__'
  const cachedSpaces = getOrganizationSpacesCache(cacheKey)
  const [messages, setMessages] = useState<AggregatedMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleOpenGroupedMessage(item: GroupedAggregatedMessageItem) {
    const pendingUnreadItems = item.groupedItems.filter((row) => !row.message.visto)
    if (pendingUnreadItems.length > 0) {
      const settledResults = await Promise.allSettled(
        pendingUnreadItems.map(async (row) => {
          await markSpaceMessageAsSeen(row.spaceId, row.message.id)
          return row
        }),
      )
      const successfullySeenItems = settledResults
        .filter((result): result is PromiseFulfilledResult<AggregatedMessageItem> => result.status === 'fulfilled')
        .map((result) => result.value)

      const seenKeySet = new Set(
        successfullySeenItems.map((row) => `${row.spaceId}:${row.message.id}`),
      )
      const unreadBySpaceId = successfullySeenItems.reduce<Record<number, number>>((acc, row) => {
        acc[row.spaceId] = (acc[row.spaceId] || 0) + 1
        return acc
      }, {})

      setMessages((current) =>
        current.map((row) =>
          seenKeySet.has(`${row.spaceId}:${row.message.id}`)
            ? {
                ...row,
                message: {
                  ...row.message,
                  visto: true,
                },
              }
            : row,
        ),
      )
      Object.entries(unreadBySpaceId).forEach(([spaceId, count]) => {
        notifySpaceUnreadMessagesUpdated(
          Number(spaceId),
          Math.max(
            0,
            messages.filter((row) => row.spaceId === Number(spaceId) && !row.message.visto)
              .length - count,
          ),
        )
      })
    }

    navigate(`/app-org/espacios/${item.spaceId}/mensajes/${item.message.id}`, {
      state: { spaceName: item.spaceName },
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadAllMessages() {
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')

      try {
        const spaces = cachedSpaces || (await listMySpaces())
        if (!cachedSpaces) {
          setOrganizationSpacesCache(cacheKey, spaces)
        }

        const responses: Array<{
          space: (typeof spaces)[number]
          response: Awaited<ReturnType<typeof listSpaceMessages>>
        }> = []
        let hasAtLeastOneResponse = false

        for (let start = 0; start < spaces.length; start += MESSAGE_BATCH_SIZE) {
          const batch = spaces.slice(start, start + MESSAGE_BATCH_SIZE)
          const batchResponses = await Promise.allSettled(
            batch.map(async (space) => ({
              space,
              response: await listSpaceMessages(space.id),
            })),
          )
          if (!isMounted) {
            return
          }
          batchResponses.forEach((result) => {
            if (result.status !== 'fulfilled') {
              return
            }
            hasAtLeastOneResponse = true
            responses.push(result.value)
          })
        }
        if (!isMounted) {
          return
        }
        if (!hasAtLeastOneResponse && spaces.length > 0) {
          throw new Error('No se pudieron cargar los mensajes de los espacios.')
        }

        responses.forEach(({ space, response }) => {
          notifySpaceUnreadMessagesUpdated(space.id, response.unread_count)
        })

        const rows = responses.flatMap(({ space, response }) =>
          response.results
            .filter((message) => message.accion?.tipo !== 'rendicion_detalle')
            .map((message) => ({
              spaceId: space.id,
              spaceName: space.nombre,
              message,
            })),
        )

        const dedupedGeneralMessages = new Map<number, AggregatedMessageItem>()
        const directMessages: AggregatedMessageItem[] = []

        rows.forEach((row) => {
          if (row.message.seccion === 'general') {
            if (!dedupedGeneralMessages.has(row.message.id)) {
              dedupedGeneralMessages.set(row.message.id, row)
            }
            return
          }
          directMessages.push(row)
        })

        setMessages([...dedupedGeneralMessages.values(), ...directMessages])
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudieron cargar los mensajes.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadAllMessages()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [cacheKey, cachedSpaces, setPageLoading])

  const sortedMessages = useMemo(
    () =>
      [...messages].sort((left, right) =>
        String(
          right.message.fecha_creacion || right.message.fecha_publicacion || '',
        ).localeCompare(
          String(left.message.fecha_creacion || left.message.fecha_publicacion || ''),
        ),
      ),
    [messages],
  )
  const generalMessages = useMemo(
    () =>
      groupOrganizationMessages(
        sortedMessages.filter((item) => item.message.seccion === 'general'),
      ),
    [sortedMessages],
  )
  const spaceMessages = useMemo(
    () =>
      groupOrganizationMessages(
        sortedMessages.filter((item) => item.message.seccion === 'espacio'),
      ),
    [sortedMessages],
  )
  const cardStyle = isDark
    ? {
        backgroundColor: '#232D4F',
        borderColor: '#E0E0E0',
        boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.25)',
      }
    : {
        backgroundColor: '#F5F5F5',
        borderColor: '#E0E0E0',
        boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.25)',
      }
  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/90' : 'text-slate-700'

  if (loading) {
    return null
  }

  if (errorMessage) {
    return (
      <section>
        <div className="mt-4 rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 p-4 text-sm text-white">
          {errorMessage}
        </div>
      </section>
    )
  }

  if (sortedMessages.length === 0) {
    return (
      <section>
        <div
          className={`progressive-card rounded-[15px] border p-5 ${
            isDark
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <p className="text-sm">Todav?a no hay mensajes en los espacios asignados.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-5">
      {generalMessages.length > 0 ? (
        <OrganizationMessageSection
          title="Mensajes generales"
          messages={generalMessages}
          onOpenMessage={handleOpenGroupedMessage}
          cardStyle={cardStyle}
          textClass={textClass}
          detailTextClass={detailTextClass}
          isDark={isDark}
        />
      ) : null}
      {spaceMessages.length > 0 ? (
        <OrganizationMessageSection
          title="Comunicaciones a espacios"
          messages={spaceMessages}
          onOpenMessage={handleOpenGroupedMessage}
          cardStyle={cardStyle}
          textClass={textClass}
          detailTextClass={detailTextClass}
          isDark={isDark}
        />
      ) : null}
    </section>
  )
}

function OrganizationMessageSection({
  title,
  messages,
  onOpenMessage,
  cardStyle,
  textClass,
  detailTextClass,
  isDark,
}: {
  title: string
  messages: GroupedAggregatedMessageItem[]
  onOpenMessage: (item: GroupedAggregatedMessageItem) => Promise<void>
  cardStyle: Record<string, string>
  textClass: string
  detailTextClass: string
  isDark: boolean
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className={`text-[16px] font-semibold ${textClass}`}>{title}</h2>
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
            isDark
              ? 'bg-white/15 text-white'
              : 'bg-slate-200 text-slate-700'
          }`}
          title="Cantidad de mensajes"
        >
          {messages.length}
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        {messages.map((item, index) => (
          <button
            key={item.groupKey}
            type="button"
            onClick={() => {
              void onOpenMessage(item)
            }}
            className={`progressive-card relative rounded-[15px] border p-4 pr-12 text-left ${
              item.unreadCount > 0 ? 'ring-1 ring-[#E7BA61]/70' : ''
            }`}
            style={{
              ...cardStyle,
              ['--card-delay' as string]: `${index * 45}ms`,
            }}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#E7BA61] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#E7BA61]">
                  {getMessageContextLabel(item.message, item.spaceName)}
                </span>
                {item.unreadCount > 0 ? (
                  <span className="rounded-full bg-[#E7BA61] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#232D4F]">
                    {item.unreadCount === 1 ? 'Nuevo' : `${item.unreadCount} nuevas`}
                  </span>
                ) : null}
              </div>
              <h3 className={`mt-2 text-[15px] font-semibold ${textClass}`}>
                {item.message.titulo}
              </h3>
              <p className={`mt-2 text-[12px] ${detailTextClass}`}>
                {formatDate(item.message.fecha_creacion || item.message.fecha_publicacion)}
              </p>
            </div>

            <span
              className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center ${
                isDark ? 'text-white' : 'text-slate-700'
              }`}
            >
              <FontAwesomeIcon
                icon={faChevronLeft}
                aria-hidden="true"
                style={{ fontSize: 22, transform: 'rotate(180deg)' }}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}



