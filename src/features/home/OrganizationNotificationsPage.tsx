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

interface AggregatedNotificationItem {
  spaceId: number
  spaceName: string
  message: SpaceMessageItem
}

interface GroupedNotificationItem {
  groupKey: string
  spaceId: number
  spaceName: string
  message: SpaceMessageItem
  groupedItems: AggregatedNotificationItem[]
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

function parseRendicionNotificationTitle(title: string): {
  projectAndConvenio: string
  rendicionSummary: string
} {
  const normalizedTitle = String(title || '')
    .trim()
    .replace(/Rendici.n/g, 'Rendición')
  const match = normalizedTitle.match(/^(Proyecto .+?)\s\|\s(Convenio .+?)\s\|\s(.+)$/i)
  if (!match) {
    return {
      projectAndConvenio: normalizedTitle || 'Rendición',
      rendicionSummary: '',
    }
  }
  return {
    projectAndConvenio: `${match[1]} - ${match[2]}`,
    rendicionSummary: match[3],
  }
}

function groupNotifications(
  messages: AggregatedNotificationItem[],
): GroupedNotificationItem[] {
  const grouped = new Map<string, GroupedNotificationItem>()

  messages.forEach((item) => {
    const rendicionId = item.message.accion?.rendicion_id
    const groupKey = rendicionId
      ? `rendicion:${rendicionId}`
      : `space:${item.spaceId}:message:${item.message.id}`
    const existing = grouped.get(groupKey)

    if (!existing) {
      grouped.set(groupKey, {
        groupKey,
        spaceId: item.spaceId,
        spaceName: item.spaceName,
        message: item.message,
        groupedItems: [item],
        unreadCount: item.message.visto ? 0 : 1,
      })
      return
    }

    existing.groupedItems.push(item)
    existing.unreadCount += item.message.visto ? 0 : 1
  })

  return Array.from(grouped.values())
}

export function OrganizationNotificationsPage() {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const cacheKey = userProfile?.username || '__anonymous__'
  const cachedSpaces = getOrganizationSpacesCache(cacheKey)
  const [notifications, setNotifications] = useState<AggregatedNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleOpenNotification(item: GroupedNotificationItem) {
    const pendingUnreadItems = item.groupedItems.filter((row) => !row.message.visto)
    if (pendingUnreadItems.length > 0) {
      await Promise.allSettled(
        pendingUnreadItems.map((row) => markSpaceMessageAsSeen(row.spaceId, row.message.id)),
      )

      const unreadBySpaceId = pendingUnreadItems.reduce<Record<number, number>>((acc, row) => {
        acc[row.spaceId] = (acc[row.spaceId] || 0) + 1
        return acc
      }, {})

      setNotifications((current) =>
        current.map((row) =>
          item.groupedItems.some(
            (groupedRow) =>
              groupedRow.spaceId === row.spaceId && groupedRow.message.id === row.message.id,
          )
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
            notifications.filter(
              (row) => row.spaceId === Number(spaceId) && !row.message.visto,
            ).length - count,
          ),
        )
      })
    }

    navigate(
      `/app-org/espacios/${item.spaceId}/rendicion/${item.message.accion?.rendicion_id}`,
      {
        state: { spaceName: item.spaceName },
      },
    )
  }

  useEffect(() => {
    let isMounted = true

    async function loadNotifications() {
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')

      try {
        const spaces = cachedSpaces ?? (await listMySpaces())
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
          throw new Error('No se pudieron cargar las notificaciones.')
        }

        responses.forEach(({ space, response }) => {
          notifySpaceUnreadMessagesUpdated(space.id, response.unread_count)
        })

        const rows = responses.flatMap(({ space, response }) =>
          response.results
            .filter((message) => message.accion?.tipo === 'rendicion_detalle')
            .map((message) => ({
              spaceId: space.id,
              spaceName: space.nombre,
              message,
            })),
        )

        setNotifications(rows)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudieron cargar las notificaciones.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadNotifications()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [cacheKey, cachedSpaces, setPageLoading])

  const groupedNotifications = useMemo(
    () =>
      groupNotifications(
        [...notifications].sort((left, right) =>
          String(
            right.message.fecha_creacion || right.message.fecha_publicacion || '',
          ).localeCompare(
            String(left.message.fecha_creacion || left.message.fecha_publicacion || ''),
          ),
        ),
      ),
    [notifications],
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
        <div className="mt-4 rounded-xl border border-[#C62828]/20 bg-[#C62828]/10 p-4 text-sm text-[#C62828]">
          {errorMessage}
        </div>
      </section>
    )
  }

  if (groupedNotifications.length === 0) {
    return (
      <section>
        <div
          className={`progressive-card rounded-[15px] border p-5 ${
            isDark
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <p className="text-sm">Todavía no hay notificaciones pendientes.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Notificaciones</h2>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C62828] px-1.5 text-[10px] font-bold text-white">
          {groupedNotifications.length}
        </span>
      </div>

      <div className="grid gap-3">
        {groupedNotifications.map((item, index) => {
          const parsed = parseRendicionNotificationTitle(item.message.titulo)
          return (
            <button
              key={item.groupKey}
              type="button"
              onClick={() => {
                void handleOpenNotification(item)
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
                <div className="flex items-start justify-between gap-3">
                  <h3 className={`min-w-0 text-[15px] font-semibold ${textClass}`}>
                    {parsed.projectAndConvenio}
                  </h3>
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C62828] px-2 text-[11px] font-bold text-white">
                    {item.unreadCount > 0 ? item.unreadCount : 1}
                  </span>
                </div>
                <p className={`mt-2 text-[13px] ${detailTextClass}`}>
                  {parsed.rendicionSummary || item.message.titulo}
                </p>
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
          )
        })}
      </div>
    </section>
  )
}
