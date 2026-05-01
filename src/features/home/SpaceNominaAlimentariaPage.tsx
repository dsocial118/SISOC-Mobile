import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDay,
  faSquareCheck,
  faChevronRight,
  faIdCard,
  faMagnifyingGlass,
  faUserPlus,
  faUserCheck,
  faUserGraduate,
  faUserXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { listSpaceNomina, type NominaPerson, type NominaStats } from '../../api/nominaApi'
import { parseApiError } from '../../api/errorUtils'
import { AppToast } from '../../ui/AppToast'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { appButtonClass } from '../../ui/buttons'

const EMPTY_STATS: NominaStats = {
  total_nomina: 0,
  genero: { M: 0, F: 0, X: 0 },
  menores_edad: 0,
  mayores_edad: 0,
}

function formatLatinDate(rawDate: string | null | undefined): string {
  const value = (rawDate || '').trim()
  if (!value) {
    return '-'
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return value
  }
  const [, year, month, day] = match
  return `${day}-${month}-${year}`
}

function calculateAgeYears(rawDate: string | null | undefined): number | null {
  const value = (rawDate || '').trim()
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }
  const [, year, month, day] = match
  const birth = new Date(Number(year), Number(month) - 1, Number(day))
  if (Number.isNaN(birth.getTime())) {
    return null
  }
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  const dayDiff = today.getDate() - birth.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1
  }
  return age >= 0 ? age : null
}

export function SpaceNominaAlimentariaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as {
      spaceName?: string
      programName?: string
      attendanceToast?: {
        tone: 'success' | 'error'
        message: string
      }
      successToast?: {
        tone: 'success' | 'error'
        message: string
      }
    } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toast, setToast] = useState(routeState?.attendanceToast ?? routeState?.successToast ?? null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<NominaStats>(EMPTY_STATS)
  const [rows, setRows] = useState<NominaPerson[]>([])
  const [showCachedDataNotice, setShowCachedDataNotice] = useState(false)

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
  const summaryCardClass = isDark ? 'bg-[#232D4F]' : 'bg-[#F5F5F5]'
  const subCardClass = isDark ? 'border-white/20 bg-white/5' : 'border-[#E0E0E0] bg-white'
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
    const incomingToast = routeState?.attendanceToast ?? routeState?.successToast
    if (!incomingToast) {
      return
    }

    setToast(incomingToast)

    const nextState = { ...routeState }
    delete nextState.attendanceToast
    delete nextState.successToast

    navigate(location.pathname, {
      replace: true,
      state: nextState,
    })
  }, [location.pathname, navigate, routeState])

  const filteredRows = useMemo(() => rows, [rows])
  const ageGroups = useMemo(
    () => ({
      ninos: rows.filter((row) => {
        const age = calculateAgeYears(row.fecha_nacimiento)
        return age !== null && age <= 13
      }).length,
      adolescentes: rows.filter((row) => {
        const age = calculateAgeYears(row.fecha_nacimiento)
        return age !== null && age >= 14 && age <= 17
      }).length,
      adultos: rows.filter((row) => {
        const age = calculateAgeYears(row.fecha_nacimiento)
        return age !== null && age >= 18 && age <= 49
      }).length,
      adultosMayores: rows.filter((row) => {
        const age = calculateAgeYears(row.fecha_nacimiento)
        return age !== null && age >= 50 && age <= 65
      }).length,
      mayoresAvanzados: rows.filter((row) => {
        const age = calculateAgeYears(row.fecha_nacimiento)
        return age !== null && age >= 66
      }).length,
    }),
    [rows],
  )

  useEffect(() => {
    let isMounted = true

    async function loadNomina() {
      if (!spaceId) {
        setErrorMessage('No se encontró el espacio seleccionado.')
        setLoading(false)
        return
      }
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        const nominaResponse = await listSpaceNomina(spaceId, {
          tab: 'alimentaria',
          q: searchQuery.trim() || undefined,
        })
        if (!isMounted) {
          return
        }
        setStats(nominaResponse.stats)
        setRows(nominaResponse.results)
        setShowCachedDataNotice(nominaResponse._source === 'cache')
      } catch (error) {
        if (!isMounted) {
          return
        }
        setShowCachedDataNotice(false)
        setErrorMessage(parseApiError(error, 'No se pudo cargar beneficiarios.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadNomina()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [searchQuery, setPageLoading, spaceId])

  function applySearch() {
    setSearchQuery(searchInput)
  }

  function clearSearch() {
    setSearchInput('')
    setSearchQuery('')
  }

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
      <AppToast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() =>
            navigate(`/app-org/espacios/${spaceId}/nomina-alimentaria/nueva`, {
              state: {
                spaceName: routeState?.spaceName,
              },
            })
          }
          className={appButtonClass({ variant: 'success', size: 'md' })}
        >
          <FontAwesomeIcon icon={faUserPlus} aria-hidden="true" />
          Agregar persona
        </button>
        <button
          type="button"
          onClick={() =>
            navigate(`/app-org/espacios/${spaceId}/nomina-alimentaria/asistencia`, {
              state: {
                spaceName: routeState?.spaceName,
              },
            })
          }
          className={appButtonClass({ variant: 'outline-secondary', size: 'md' })}
        >
          <FontAwesomeIcon icon={faSquareCheck} aria-hidden="true" />
          Asistencia
        </button>
      </div>
      {showCachedDataNotice ? (
        <div className="rounded-xl border border-[#E7BA61]/40 bg-[#E7BA61]/15 px-3 py-2 text-[12px] font-semibold text-[#8C6A1D]">
          Mostrando datos guardados por conexión lenta.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        <div
          className={`rounded-2xl border p-3 text-center ${summaryCardClass}`}
          style={{ ...cardStyle, borderColor: '#E7BA61' }}
        >
          <div className="mt-1 py-1">
            <p className={`text-[20px] font-extrabold leading-none ${textClass}`}>
              Asistentes: {stats.total_nomina}
            </p>
            <div className={`mt-2 flex items-center justify-center gap-8 ${textClass}`}>
              <p className="text-[14px] font-medium">M: <span className="text-[16px] font-bold">{stats.genero.M}</span></p>
              <p className="text-[14px] font-medium">F: <span className="text-[16px] font-bold">{stats.genero.F}</span></p>
              <p className="text-[14px] font-medium">X: <span className="text-[16px] font-bold">{stats.genero.X}</span></p>
            </div>
          </div>
        </div>
        <div
          className={`rounded-2xl border p-3 ${summaryCardClass}`}
          style={{ ...cardStyle, borderColor: '#E7BA61' }}
        >
          <p className={`text-center text-[16px] font-bold ${textClass}`}>Edades</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-10 gap-y-1">
            {[
              { label: '0-13', value: ageGroups.ninos },
              { label: '14-17', value: ageGroups.adolescentes },
              { label: '18-49', value: ageGroups.adultos },
              { label: '50-65', value: ageGroups.adultosMayores },
              { label: '66+', value: ageGroups.mayoresAvanzados },
            ].map((item) => (
              <li
                key={item.label}
                className="py-0.5 text-center"
              >
                <span className={`text-[14px] font-medium ${detailTextClass}`}>
                  {item.label}: <span className={`text-[16px] font-bold ${textClass}`}>{item.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className={`rounded-[15px] border px-3 py-2 ${isDark ? 'bg-[#232D4F]' : 'bg-[#F5F5F5]'}`}
        style={cardStyle}
      >
        <div className="flex items-center gap-2">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                applySearch()
              }
            }}
            placeholder="Buscar por apellido o DNI"
            className={`w-full bg-transparent text-sm italic outline-none ${isDark ? 'text-white placeholder:text-white/70' : 'text-[#555555] placeholder:text-[#555555]'}`}
          />
          <button
            type="button"
            onClick={applySearch}
            className={`${isDark ? 'text-white' : 'text-[#232D4F]'}`}
            aria-label="Buscar"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" style={{ fontSize: 16 }} />
          </button>
          {searchInput.trim() || searchQuery.trim() ? (
            <button
              type="button"
              onClick={clearSearch}
              className={`text-xs font-semibold ${isDark ? 'text-white/80' : 'text-[#232D4F]/80'}`}
            >
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="grid gap-2">
          <p className={`text-sm ${detailTextClass}`}>
            {rows.length === 0
              ? 'No hay personas vinculadas a prestaciones alimentarias en este espacio.'
              : 'No hay personas que coincidan con la búsqueda seleccionada.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() =>
                navigate(`/app-org/espacios/${spaceId}/nomina-alimentaria/${row.id}`, {
                  state: {
                    spaceName: routeState?.spaceName,
                    personName: `${row.apellido}, ${row.nombre}`,
                  },
                })
              }
              className={`rounded-xl border p-4 text-left ${subCardClass}`}
              style={cardStyle}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[15px] font-semibold ${textClass}`}>
                    {row.apellido}, {row.nombre}
                  </p>
                  <div
                    className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${detailTextClass}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faIdCard} aria-hidden="true" style={{ fontSize: 11 }} />
                      {row.dni || 'Sin documento'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FontAwesomeIcon
                        icon={faCalendarDay}
                        aria-hidden="true"
                        style={{ fontSize: 11 }}
                      />
                      {formatLatinDate(row.fecha_nacimiento)}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${detailTextClass}`}>
                      <span>Asitencia:</span>
                      <FontAwesomeIcon
                        icon={row.asistencia_mes_actual ? faUserCheck : faUserXmark}
                        className={row.asistencia_mes_actual ? 'text-[#2E7D33]' : 'text-[#C62828]'}
                        aria-hidden="true"
                        style={{ fontSize: 14 }}
                      />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {row.badges.includes('Actividades') ? (
                    <FontAwesomeIcon
                      icon={faUserGraduate}
                      aria-hidden="true"
                      className="text-[#232D4F]"
                      style={{ fontSize: 14 }}
                    />
                  ) : null}
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    aria-hidden="true"
                    className={`${isDark ? 'text-white/80' : 'text-slate-500'}`}
                    style={{ fontSize: 14 }}
                  />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}




