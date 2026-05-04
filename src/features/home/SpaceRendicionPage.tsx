import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDay,
  faChevronRight,
  faFileLines,
  faFolderOpen,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import type { RendicionItem } from '../../api/rendicionApi'
import { syncNow } from '../../sync/engine'
import { appButtonClass, joinClasses } from '../../ui/buttons'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { formatDateTime, loadRendicionesOfflineFirst } from './rendicionOffline'
import { getRendicionListCache, setRendicionListCache } from './rendicionViewCache'

function getStatusClasses(status: string, isDark: boolean): string {
  if (status === 'revision') {
    return isDark
      ? 'bg-[#E7BA61]/20 text-[#F7D58D]'
      : 'bg-[#FFF4D6] text-[#8C6A1D]'
  }
  if (status === 'finalizada') {
    return isDark
      ? 'bg-[#2E7D33]/20 text-[#A5D6A7]'
      : 'bg-[#E8F5E9] text-[#2E7D33]'
  }
  if (status === 'subsanar') {
    return isDark
      ? 'bg-[#C62828]/20 text-[#FFCDD2]'
      : 'bg-[#FDECEC] text-[#C62828]'
  }
  return isDark
    ? 'bg-white/10 text-white'
    : 'bg-[#EEF2FF] text-[#232D4F]'
}

export function SpaceRendicionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as
      | {
          spaceName?: string
          programName?: string
          projectName?: string
          organizationName?: string
        }
      | null) ?? null

  const cachedRows = spaceId ? getRendicionListCache(spaceId) : null

  const [loading, setLoading] = useState(!cachedRows)
  const [errorMessage, setErrorMessage] = useState('')
  const [rows, setRows] = useState<RendicionItem[]>(cachedRows ?? [])

  const titleClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const subtitleClass = isDark ? 'text-white/80' : 'text-slate-600'
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

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!spaceId) {
        setErrorMessage('No se encontr? el espacio seleccionado.')
        setLoading(false)
        return
      }

      const hasCachedRows = getRendicionListCache(spaceId) !== null
      setPageLoading(!hasCachedRows)
      if (!hasCachedRows) {
        setLoading(true)
      }
      setErrorMessage('')

      try {
        const response = await loadRendicionesOfflineFirst(spaceId)
        if (!isMounted) {
          return
        }
        setRows(response)
        setRendicionListCache(spaceId, response)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(
          parseApiError(error, 'No se pudo cargar la rendicion de cuentas.', {
            timeoutMessage:
              'La rendicion est? demorando m?s de lo esperado. Prob? nuevamente en unos segundos.',
          }),
        )
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadData()
    void syncNow()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [setPageLoading, spaceId])

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

  return (
    <section className="grid gap-3 pb-24">
      <div>
        <h2 className={`text-[16px] font-semibold ${titleClass}`}>Rendicion de cuentas</h2>
        <p className={`mt-1 text-sm ${subtitleClass}`}>
          {routeState?.organizationName && (routeState?.projectName || routeState?.programName)
            ? `${routeState.organizationName} - ${routeState.projectName || routeState.programName}`
            : 'Historial del contexto operativo activo.'}
        </p>
      </div>

      {rows.length === 0 ? (
        <article className="rounded-xl border p-5 text-center" style={cardStyle}>
          <FontAwesomeIcon
            icon={faFolderOpen}
            aria-hidden="true"
            className={subtitleClass}
            style={{ fontSize: 24 }}
          />
          <p className={`mt-3 text-sm ${subtitleClass}`}>
            Todav?a no hay rendiciones cargadas para este contexto.
          </p>
        </article>
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() =>
                navigate(`/app-org/espacios/${spaceId}/rendicion/${row.id}`, {
                  state: routeState,
                })
              }
              className="rounded-xl border p-4 text-left"
              style={cardStyle}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className={`text-[15px] font-semibold ${titleClass}`}>
                    Rendición {row.numero_rendicion ?? row.id}
                  </p>
                  <p className={`mt-1 text-[12px] ${subtitleClass}`}>
                    Convenio: {row.convenio || 'Sin dato'}
                  </p>
                  <p
                    className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClasses(row.estado, isDark)}`}
                  >
                    {row.estado_label}
                  </p>
                  <div className={`mt-3 grid gap-1 text-[12px] ${subtitleClass}`}>
                    <p className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faCalendarDay} aria-hidden="true" style={{ fontSize: 11 }} />
                      {row.periodo_label}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faFileLines} aria-hidden="true" style={{ fontSize: 11 }} />
                      Creada el {formatDateTime(row.fecha_creacion)}
                    </p>
                  </div>
                </div>
                <div className="flex h-full items-center">
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    aria-hidden="true"
                    className={isDark ? 'text-white/80' : 'text-slate-500'}
                    style={{ fontSize: 14 }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          navigate(`/app-org/espacios/${spaceId}/rendicion/nueva`, {
            state: routeState,
          })
        }
        className={joinClasses(
          appButtonClass({ variant: 'success', size: 'md' }),
          'fixed bottom-20 right-4 z-20 h-14 w-14 rounded-full p-0 shadow-[0_10px_24px_rgba(46,125,51,0.35)]',
        )}
        aria-label="Nueva rendicion"
      >
        <FontAwesomeIcon icon={faPlus} aria-hidden="true" style={{ fontSize: 22 }} />
      </button>
    </section>
  )
}



