import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { listSpaceMessages, type SpaceMessageItem } from '../../api/messagesApi'
import { parseApiError } from '../../api/errorUtils'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { notifySpaceUnreadMessagesUpdated } from './useUnreadMessages'

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

export function SpaceMessagesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState = (location.state as { spaceName?: string } | null) ?? null
  const [messages, setMessages] = useState<SpaceMessageItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadGeneralCount, setUnreadGeneralCount] = useState(0)
  const [unreadSpaceCount, setUnreadSpaceCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadMessages() {
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')

      if (!spaceId) {
        setErrorMessage('No se encontró el espacio seleccionado.')
        setLoading(false)
        setPageLoading(false)
        return
      }

      try {
        const response = await listSpaceMessages(spaceId)
        if (!isMounted) {
          return
        }
        setMessages(response.results)
        setUnreadCount(response.unread_count)
        setUnreadGeneralCount(response.unread_general_count)
        setUnreadSpaceCount(response.unread_espacio_count)
        notifySpaceUnreadMessagesUpdated(spaceId, response.unread_count)
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

    void loadMessages()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [setPageLoading, spaceId])

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

  const sortedMessages = useMemo(
    () =>
      [...messages].sort((left, right) =>
        String(right.fecha_creacion || right.fecha_publicacion || '').localeCompare(
          String(left.fecha_creacion || left.fecha_publicacion || ''),
        )),
    [messages],
  )
  const generalMessages = useMemo(
    () => sortedMessages.filter((message) => message.seccion === 'general'),
    [sortedMessages],
  )
  const spaceMessages = useMemo(
    () => sortedMessages.filter((message) => message.seccion === 'espacio'),
    [sortedMessages],
  )

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

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-[16px] font-semibold ${textClass}`}>Mensajes del Espacio</h2>
          <p className={`mt-1 text-sm ${detailTextClass}`}>
            {unreadCount === 0
              ? 'No hay mensajes sin leer.'
              : unreadCount === 1
                ? 'Tenés 1 mensaje sin leer.'
                : `Tenés ${unreadCount} mensajes sin leer.`}
          </p>
        </div>
        <div
          className={`flex min-w-[74px] items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${
            unreadCount > 0
              ? 'border-[#E7BA61] bg-[#232D4F] text-white'
              : isDark
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          <FontAwesomeIcon icon={faBell} aria-hidden="true" className="mr-2" />
          {unreadCount}
        </div>
      </div>

      {sortedMessages.length === 0 ? (
        <div
          className={`progressive-card mt-4 rounded-[15px] border p-5 ${
            isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <p className="text-sm">Todavía no hay mensajes para este espacio.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-5">
          <MessageSection
            title="Notificaciones Generales"
            unreadCount={unreadGeneralCount}
            messages={generalMessages}
            emptyMessage="Todavía no hay notificaciones generales."
            spaceId={spaceId}
            spaceName={routeState?.spaceName}
            navigate={navigate}
            cardStyle={cardStyle}
            textClass={textClass}
            detailTextClass={detailTextClass}
            isDark={isDark}
          />
          <MessageSection
            title="Comunicaciones a Espacios"
            unreadCount={unreadSpaceCount}
            messages={spaceMessages}
            emptyMessage="Todavía no hay comunicaciones para este espacio."
            spaceId={spaceId}
            spaceName={routeState?.spaceName}
            navigate={navigate}
            cardStyle={cardStyle}
            textClass={textClass}
            detailTextClass={detailTextClass}
            isDark={isDark}
          />
        </div>
      )}
    </section>
  )
}

function MessageSection({
  title,
  unreadCount,
  messages,
  emptyMessage,
  spaceId,
  spaceName,
  navigate,
  cardStyle,
  textClass,
  detailTextClass,
  isDark,
}: {
  title: string
  unreadCount: number
  messages: SpaceMessageItem[]
  emptyMessage: string
  spaceId?: string
  spaceName?: string
  navigate: ReturnType<typeof useNavigate>
  cardStyle: Record<string, string>
  textClass: string
  detailTextClass: string
  isDark: boolean
}) {
  return (
    <section>
      <div>
        <h3 className={`text-[15px] font-semibold ${textClass}`}>{title}</h3>
        <p className={`mt-1 text-xs ${detailTextClass}`}>
          {unreadCount === 0
            ? 'Sin mensajes sin leer.'
            : unreadCount === 1
              ? '1 mensaje sin leer.'
              : `${unreadCount} mensajes sin leer.`}
        </p>
      </div>

      {messages.length === 0 ? (
        <div
          className={`mt-3 rounded-[15px] border p-4 ${
            isDark ? 'border-white/20 bg-white/5 text-white/85' : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {messages.map((message, index) => (
            <button
              key={message.id}
              type="button"
              onClick={() =>
                navigate(`/app-org/espacios/${spaceId || ''}/mensajes/${message.id}`, {
                  state: { spaceName },
                })
              }
              className={`progressive-card relative rounded-[15px] border p-4 pr-12 text-left ${
                !message.visto ? 'ring-1 ring-[#E7BA61]/70' : ''
              }`}
              style={{
                ...cardStyle,
                ['--card-delay' as string]: `${index * 45}ms`,
              }}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {!message.visto ? (
                    <span className="rounded-full bg-[#E7BA61] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#232D4F]">
                      Nuevo
                    </span>
                  ) : null}
                  {message.destacado ? (
                    <span className="rounded-full border border-[#E7BA61] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#E7BA61]">
                      Destacado
                    </span>
                  ) : null}
                </div>
                <h4 className={`mt-2 text-[15px] font-semibold ${textClass}`}>
                  {message.titulo}
                </h4>
                <p className={`mt-2 text-[12px] ${detailTextClass}`}>
                  {formatDate(message.fecha_creacion || message.fecha_publicacion)}
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
      )}
    </section>
  )
}
