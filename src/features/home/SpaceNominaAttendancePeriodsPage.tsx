import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDay,
  faChevronRight,
  faIdCard,
  faUserCheck,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import {
  getNominaAttendancePeriodDetail,
  listNominaAttendancePeriods,
  type NominaAttendanceAttendee,
  type NominaAttendancePeriodItem,
  type NominaTab,
} from '../../api/nominaApi'
import { AppToast } from '../../ui/AppToast'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

function formatAttendanceTimestamp(rawValue: string | null | undefined): string {
  const value = (rawValue || '').trim()
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function SpaceNominaAttendancePeriodsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId, periodo } = useParams<{ spaceId: string; periodo?: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as {
      spaceName?: string
      tab?: NominaTab
    } | null) ?? null
  const queryTab = new URLSearchParams(location.search).get('tab') as NominaTab | null
  const tab = routeState?.tab ?? queryTab ?? 'alimentaria'
  const isDetail = Boolean(periodo)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [periods, setPeriods] = useState<NominaAttendancePeriodItem[]>([])
  const [periodLabel, setPeriodLabel] = useState('')
  const [attendees, setAttendees] = useState<NominaAttendanceAttendee[]>([])

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
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
        setErrorMessage('No se encontró el espacio seleccionado.')
        setLoading(false)
        return
      }
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        if (periodo) {
          const detail = await getNominaAttendancePeriodDetail(spaceId, periodo, { tab })
          if (!isMounted) {
            return
          }
          setPeriodLabel(detail.periodo_label)
          setAttendees(detail.asistentes)
          return
        }
        const response = await listNominaAttendancePeriods(spaceId, { tab })
        if (!isMounted) {
          return
        }
        setPeriods(response.results)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar el historial de asistencias.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [periodo, setPageLoading, spaceId, tab])

  if (loading) {
    return null
  }

  return (
    <section className="grid gap-3 pb-24">
      <AppToast
        open={Boolean(errorMessage)}
        message={errorMessage}
        tone="error"
        onClose={() => setErrorMessage('')}
      />

      <div>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>
          {isDetail ? `Asistentes del periodo ${periodLabel}` : 'Periodos de asistencia'}
        </h2>
        <p className={`mt-1 text-sm ${detailTextClass}`}>
          {routeState?.spaceName ? `${routeState.spaceName} · ` : ''}
          {tab === 'formacion' ? 'Nomina de actividades' : 'Nomina alimentaria'}
        </p>
      </div>

      {!isDetail && periods.length === 0 ? (
        <div className={`rounded-xl border p-4 text-sm ${detailTextClass}`} style={cardStyle}>
          Todavía no hay períodos con asistencia registrada.
        </div>
      ) : null}

      {!isDetail ? (
        <div className="grid gap-2">
          {periods.map((item) => (
            <button
              key={item.periodo_referencia}
              type="button"
              onClick={() =>
                navigate(
                  `/app-org/espacios/${spaceId}/nomina/asistencias/${item.periodo_referencia}?tab=${tab}`,
                  {
                    state: {
                      spaceName: routeState?.spaceName,
                      tab,
                    },
                  },
                )
              }
              className="rounded-xl border p-4 text-left"
              style={cardStyle}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`text-[15px] font-semibold ${textClass}`}>
                    Periodo {item.periodo_label}
                  </p>
                  <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                    {item.total_asistentes} asistentes registrados
                  </p>
                </div>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  aria-hidden="true"
                  className={isDark ? 'text-white/80' : 'text-slate-500'}
                  style={{ fontSize: 14 }}
                />
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {isDetail && attendees.length === 0 ? (
        <div className={`rounded-xl border p-4 text-sm ${detailTextClass}`} style={cardStyle}>
          No hay asistentes registrados para este período.
        </div>
      ) : null}

      {isDetail ? (
        <div className="grid gap-2">
          {attendees.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                navigate(
                  `/app-org/espacios/${spaceId}/${
                    tab === 'alimentaria' ? 'nomina-alimentaria' : 'nomina'
                  }/${item.nomina_id}`,
                  {
                    state: {
                      spaceName: routeState?.spaceName,
                      personName: `${item.apellido}, ${item.nombre}`,
                    },
                  },
                )
              }
              className="rounded-xl border p-4 text-left"
              style={cardStyle}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[15px] font-semibold ${textClass}`}>
                    {item.apellido}, {item.nombre}
                  </p>
                  <div
                    className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${detailTextClass}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faIdCard} aria-hidden="true" style={{ fontSize: 11 }} />
                      {item.dni || 'Sin documento'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faCalendarDay} aria-hidden="true" style={{ fontSize: 11 }} />
                      {formatAttendanceTimestamp(item.fecha_toma_asistencia)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faUserCheck} aria-hidden="true" style={{ fontSize: 11 }} />
                      {item.tomado_por || 'usuario no disponible'}
                    </span>
                  </div>
                </div>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  aria-hidden="true"
                  className={isDark ? 'text-white/80' : 'text-slate-500'}
                  style={{ fontSize: 14 }}
                />
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
