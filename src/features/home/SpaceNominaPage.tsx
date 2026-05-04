import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDay,
  faSquareCheck,
  faChevronRight,
  faIdCard,
  faMagnifyingGlass,
  faUsers,
  faUserPlus,
  faUserGraduate,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  listSpaceNomina,
  type NominaPerson,
  type NominaStats,
  type NominaTab,
} from '../../api/nominaApi'
import { parseApiError } from '../../api/errorUtils'
import { appButtonClass } from '../../ui/buttons'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

const EMPTY_STATS: NominaStats = {
  total_nomina: 0,
  genero: { M: 0, F: 0, X: 0 },
  menores_edad: 0,
  mayores_edad: 0,
}

function formatPeopleLabel(value: number): string {
  return String(value)
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

export function SpaceNominaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as { spaceName?: string; programName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [tab, setTab] = useState<NominaTab>('consolidada')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<NominaStats>(EMPTY_STATS)
  const [rows, setRows] = useState<NominaPerson[]>([])
  const [showCachedDataNotice, setShowCachedDataNotice] = useState(false)

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
  const subCardClass = isDark ? 'border-white/20 bg-white/5' : 'border-[#E0E0E0] bg-white'
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
  const filteredRows = useMemo(() => rows, [rows])

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
          tab,
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
  }, [searchQuery, setPageLoading, spaceId, tab])

  function applySearch() {
    setSearchQuery(searchInput)
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
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              aria-hidden="true"
              style={{ fontSize: 16 }}
            />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['consolidada', 'Consolidada', faUsers],
          ['alimentaria', 'Alimentarias', faUtensils],
          ['formacion', 'Actividades', faUserGraduate],
        ] as Array<[NominaTab, string, typeof faUsers]>).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              tab === key
                ? 'border-[#E7BA61] bg-[#232D4F] text-white'
                : isDark
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <FontAwesomeIcon icon={icon} aria-hidden="true" style={{ fontSize: 11 }} />
              {label}
            </span>
          </button>
        ))}
      </div>

      <div className="px-3 py-1">
        <div className={`flex items-center justify-between gap-3 border-b pb-3 ${isDark ? 'border-white/20' : 'border-slate-300'}`}>
          <p className={`text-[16px] font-bold ${textClass}`}>Total de Beneficiarios</p>
          <p className={`text-[16px] font-bold ${textClass}`}>{formatPeopleLabel(stats.total_nomina)}</p>
        </div>
        <div className={`mt-3 space-y-1.5 text-[14px] ${detailTextClass}`}>
          <div className="flex items-center justify-between gap-3">
            <span>Total Femenino</span>
            <span className={`font-bold ${textClass}`}>{formatPeopleLabel(stats.genero.F)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Total Masculino</span>
            <span className={`font-bold ${textClass}`}>{formatPeopleLabel(stats.genero.M)}</span>
          </div>
          {stats.genero.X > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span>Total X</span>
              <span className={`font-bold ${textClass}`}>{formatPeopleLabel(stats.genero.X)}</span>
            </div>
          ) : null}
        </div>
        <div className={`my-3 border-t ${isDark ? 'border-white/20' : 'border-slate-300'}`} />
        <div className={`space-y-1.5 text-[14px] ${detailTextClass}`}>
          <div className="flex items-center justify-between gap-3">
            <span>Mayores de edad</span>
            <span className={`font-bold ${textClass}`}>{formatPeopleLabel(stats.mayores_edad)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Menores de edad</span>
            <span className={`font-bold ${textClass}`}>{formatPeopleLabel(stats.menores_edad)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
        <button
          type="button"
          onClick={() =>
            navigate(`/app-org/espacios/${spaceId}/nomina/nueva`, {
              state: {
                spaceName: routeState?.spaceName,
                defaultMode: tab === 'formacion' ? 'formacion' : 'alimentaria',
              },
            })
          }
          className={appButtonClass({ variant: 'success', size: 'md' })}
        >
          <FontAwesomeIcon icon={faUserPlus} aria-hidden="true" />
          Agregar persona
        </button>
      </div>

      {showCachedDataNotice ? (
        <div className="rounded-xl border border-[#E7BA61]/40 bg-[#E7BA61]/15 px-3 py-2 text-[12px] font-semibold text-[#8C6A1D]">
          Mostrando datos guardados por conexión lenta.
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="grid gap-2">
          <p className={`text-sm ${detailTextClass}`}>
            {tab === 'formacion'
              ? 'No hay personas vinculadas a Actividades en este espacio.'
              : tab === 'alimentaria'
                ? 'No hay personas vinculadas a prestaciones alimentarias en este espacio.'
                : 'No hay personas para la búsqueda seleccionada.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() =>
                navigate(`/app-org/espacios/${spaceId}/nomina/${row.id}`, {
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
                      <FontAwesomeIcon
                        icon={faIdCard}
                        aria-hidden="true"
                        style={{ fontSize: 11 }}
                      />
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
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {row.badges.includes('Alimentación') ? (
                    <FontAwesomeIcon
                      icon={faUtensils}
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




