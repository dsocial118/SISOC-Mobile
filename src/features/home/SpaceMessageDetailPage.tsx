import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperclip } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  getSpaceMessageDetail,
  markSpaceMessageAsSeen,
  type SpaceMessageAttachment,
  type SpaceMessageItem,
} from '../../api/messagesApi'
import { parseApiError } from '../../api/errorUtils'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { useAuth } from '../../auth/useAuth'
import {
  notifySpaceUnreadMessagesUpdated,
  useSpaceUnreadMessages,
} from './useUnreadMessages'

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

function isPdfAttachment(attachment: SpaceMessageAttachment): boolean {
  const source = `${attachment.nombre_original || ''} ${attachment.url || ''}`.toLowerCase()
  return source.includes('.pdf')
}

function isImageAttachment(attachment: SpaceMessageAttachment): boolean {
  const source = `${attachment.nombre_original || ''} ${attachment.url || ''}`.toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].some((extension) =>
    source.includes(extension),
  )
}

function getMessageContextLabel(message: SpaceMessageItem, spaceName?: string): string | null {
  if (message.accion?.tipo === 'rendicion_detalle') {
    const normalizedTitle = String(message.titulo || '').trim()
    const match = normalizedTitle.match(
      /^(Proyecto .+?\s\|\sConvenio .+?)\s\|\sRendici.n\s/i,
    )
    return match ? match[1] : 'Rendicion'
  }
  return spaceName || null
}

export function SpaceMessageDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId, messageId } = useParams<{ spaceId: string; messageId: string }>()
  const { userProfile } = useAuth()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const currentUnreadCount = useSpaceUnreadMessages(spaceId, userProfile?.username)
  const unreadCountRef = useRef(currentUnreadCount)
  const routeState = (location.state as { spaceName?: string } | null) ?? null
  const [message, setMessage] = useState<SpaceMessageItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    unreadCountRef.current = currentUnreadCount
  }, [currentUnreadCount])

  useEffect(() => {
    let isMounted = true

    async function loadMessage() {
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')

      if (!spaceId || !messageId) {
        setErrorMessage('No se encontro el mensaje seleccionado.')
        setLoading(false)
        setPageLoading(false)
        return
      }

      try {
        const detail = await getSpaceMessageDetail(spaceId, messageId)
        if (!isMounted) {
          return
        }

        let nextMessage = detail
        if (!detail.visto) {
          nextMessage = await markSpaceMessageAsSeen(spaceId, messageId)
          if (!isMounted) {
            return
          }
          notifySpaceUnreadMessagesUpdated(spaceId, Math.max(0, unreadCountRef.current - 1))
        }

        setMessage(nextMessage)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar el mensaje.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadMessage()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [messageId, setPageLoading, spaceId])

  const cardClass = isDark
    ? 'border-white/20 bg-[#232D4F] text-white'
    : 'border-slate-200 bg-[#F5F5F5] text-[#232D4F]'
  const nestedCardClass = isDark
    ? 'border-white/20 bg-white/5 text-white'
    : 'border-slate-200 bg-white text-slate-700'
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
  const imageAttachments = useMemo(
    () => (message ? message.adjuntos.filter(isImageAttachment) : []),
    [message],
  )
  const pdfAttachments = useMemo(
    () =>
      (message ? message.adjuntos.filter((attachment) => !isImageAttachment(attachment) && isPdfAttachment(attachment)) : []),
    [message],
  )
  const fileAttachments = useMemo(
    () =>
      (message
        ? message.adjuntos.filter(
            (attachment) => !isImageAttachment(attachment) && !isPdfAttachment(attachment),
          )
        : []),
    [message],
  )
  const contextLabel = useMemo(
    () => (message ? getMessageContextLabel(message, routeState?.spaceName) : null),
    [message, routeState?.spaceName],
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

  if (!message) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className={`rounded-[18px] border p-4 shadow-sm ${cardClass}`}>
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
          {contextLabel ? (
            <span className="rounded-full border border-[#E7BA61] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#E7BA61]">
              {contextLabel}
            </span>
          ) : null}
        </div>

        <h2 className="mt-3 text-[20px] font-semibold leading-tight">{message.titulo}</h2>
        <div className={`mt-3 space-y-1 text-[12px] ${detailTextClass}`}>
          <p>Creado: {formatDate(message.fecha_creacion)}</p>
          <p>Publicado: {formatDate(message.fecha_publicacion)}</p>
          {message.fecha_visto ? <p>Visto: {formatDate(message.fecha_visto)}</p> : null}
          {message.fecha_vencimiento ? <p>Vence: {formatDate(message.fecha_vencimiento)}</p> : null}
        </div>
      </div>

      <article className={`rounded-[18px] border p-4 shadow-sm ${cardClass}`}>
        <p className={`whitespace-pre-line text-[15px] leading-7 ${detailTextClass}`}>
          {message.cuerpo}
        </p>
        {message.accion?.tipo === 'rendicion_detalle' && spaceId ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/app-org/espacios/${spaceId}/rendicion/${message.accion?.rendicion_id}`,
                  {
                    state: routeState,
                  },
                )
              }
              className="inline-flex items-center justify-center rounded-xl bg-[#2E7D33] px-4 py-3 text-sm font-semibold text-white"
            >
              Abrir rendición
            </button>
          </div>
        ) : null}
      </article>

      {imageAttachments.length > 0 ? (
        <section className="space-y-3">
          <h3 className={`text-[14px] font-semibold ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
            Imagenes adjuntas
          </h3>
          <div className="grid gap-3">
            {imageAttachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url || '#'}
                target="_blank"
                rel="noreferrer"
                download={attachment.nombre_original || undefined}
                className={`overflow-hidden rounded-[18px] border ${nestedCardClass} ${
                  attachment.url ? '' : 'pointer-events-none opacity-60'
                }`}
              >
                {attachment.url ? (
                  <img
                    src={attachment.url}
                    alt={attachment.nombre_original || 'Imagen adjunta'}
                    className="h-auto w-full object-cover"
                  />
                ) : null}
                <div className="p-3 text-sm">{attachment.nombre_original || 'Imagen adjunta'}</div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {pdfAttachments.length > 0 ? (
        <section className="space-y-3">
          <h3 className={`text-[14px] font-semibold ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
            PDF adjuntos
          </h3>
          <div className="grid gap-3">
            {pdfAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`overflow-hidden rounded-[18px] border ${nestedCardClass}`}
              >
                {attachment.url ? (
                  <iframe
                    title={attachment.nombre_original || `Adjunto ${attachment.id}`}
                    src={attachment.url}
                    className="h-[320px] w-full border-0"
                  />
                ) : null}
                <div className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{attachment.nombre_original || 'Adjunto PDF'}</p>
                    <p className={`mt-1 text-xs ${detailTextClass}`}>
                      Subido: {formatDate(attachment.fecha_subida)}
                    </p>
                  </div>
                  <a
                    href={attachment.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    download={attachment.nombre_original || undefined}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      isDark ? 'border-white/30 text-white' : 'border-slate-300 text-slate-700'
                    } ${attachment.url ? '' : 'pointer-events-none opacity-60'}`}
                  >
                    Descargar
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {fileAttachments.length > 0 ? (
        <section className="space-y-3">
          <h3 className={`text-[14px] font-semibold ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
            Documentos adjuntos
          </h3>
          <div className="grid gap-2">
            {fileAttachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url || '#'}
                target="_blank"
                rel="noreferrer"
                download={attachment.nombre_original || undefined}
                className={`flex items-center gap-2 rounded-[16px] border px-3 py-3 text-sm ${nestedCardClass} ${
                  attachment.url ? '' : 'pointer-events-none opacity-60'
                }`}
              >
                <FontAwesomeIcon icon={faPaperclip} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate">{attachment.nombre_original || 'Adjunto'}</p>
                  <p className={`mt-1 text-xs ${detailTextClass}`}>
                    Subido: {formatDate(attachment.fecha_subida)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  )
}
