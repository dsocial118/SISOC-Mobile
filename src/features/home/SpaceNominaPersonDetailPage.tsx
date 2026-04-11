import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCirclePlus,
  faCalendarDay,
  faCheck,
  faClock,
  faTrashCan,
  faUsers,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import {
  deleteNominaPerson,
  getNominaPersonDetail,
  listNominaAttendanceHistory,
  registerNominaAttendance,
  type NominaAttendanceRecord,
  type NominaPerson,
} from '../../api/nominaApi'
import { appButtonClass, joinClasses } from '../../ui/buttons'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

function formatLatinDate(rawDate: string | null | undefined): string {
  const value = (rawDate || '').trim()
  if (!value) {
    return '-'
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const [, year, month, day] = match
    return `${day}-${month}-${year}`
  }
  return value
}

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

function getCurrentPeriodLabel(): string {
  return new Intl.DateTimeFormat('es-AR', {
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())
}

type GroupedLinkedActivity = {
  categoria: string
  actividades: Array<{
    nombre: string
    dias: Array<{
      nombre: string
      horarios: string[]
    }>
  }>
}

function groupLinkedActivities(
  actividades: NominaPerson['actividades'],
): GroupedLinkedActivity[] {
  const categoriaMap = new Map<string, Map<string, Map<string, Set<string>>>>()

  for (const item of actividades) {
    if (!categoriaMap.has(item.categoria)) {
      categoriaMap.set(item.categoria, new Map<string, Map<string, Set<string>>>())
    }
    const actividadMap = categoriaMap.get(item.categoria)!
    if (!actividadMap.has(item.actividad)) {
      actividadMap.set(item.actividad, new Map<string, Set<string>>())
    }
    const diaMap = actividadMap.get(item.actividad)!
    if (!diaMap.has(item.dia)) {
      diaMap.set(item.dia, new Set<string>())
    }
    diaMap.get(item.dia)!.add(item.horario)
  }

  return Array.from(categoriaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoria, actividadMap]) => ({
      categoria,
      actividades: Array.from(actividadMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([nombre, diaMap]) => ({
          nombre,
          dias: Array.from(diaMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([nombreDia, horariosSet]) => ({
              nombre: nombreDia,
              horarios: Array.from(horariosSet.values()).sort((a, b) => a.localeCompare(b)),
            })),
        })),
    }))
}

export function SpaceNominaPersonDetailPage() {
  const navigate = useNavigate()
  const { spaceId, nominaId } = useParams<{ spaceId: string; nominaId: string }>()
  const location = useLocation()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as { spaceName?: string; personName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [person, setPerson] = useState<NominaPerson | null>(null)
  const [history, setHistory] = useState<NominaAttendanceRecord[]>([])
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [deletingPerson, setDeletingPerson] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const currentPeriodLabel = getCurrentPeriodLabel()

  useEffect(() => {
    let isMounted = true

    async function loadDetail() {
      if (!spaceId || !nominaId) {
        setErrorMessage('No se encontró la persona seleccionada.')
        setLoading(false)
        return
      }

      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        const [detail, attendanceHistory] = await Promise.all([
          getNominaPersonDetail(spaceId, nominaId),
          listNominaAttendanceHistory(spaceId, nominaId),
        ])
        if (!isMounted) {
          return
        }
        setPerson(detail)
        setHistory(attendanceHistory)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar el detalle de la persona.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadDetail()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [nominaId, setPageLoading, spaceId])

  async function handleRegisterAttendance() {
    if (!spaceId || !nominaId || !person) {
      return
    }
    setSavingAttendance(true)
    setErrorMessage('')
    try {
      await registerNominaAttendance(spaceId, nominaId)
      const [detail, attendanceHistory] = await Promise.all([
        getNominaPersonDetail(spaceId, nominaId),
        listNominaAttendanceHistory(spaceId, nominaId),
      ])
      setPerson(detail)
      setHistory(attendanceHistory)
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo registrar la asistencia mensual.'))
    } finally {
      setSavingAttendance(false)
    }
  }

  async function handleDeletePerson() {
    if (!spaceId || !nominaId || !person || deletingPerson) {
      return
    }

    setDeletingPerson(true)
    setShowDeleteConfirm(false)
    setErrorMessage('')
    try {
      await deleteNominaPerson(spaceId, nominaId)
      navigate(`/app-org/espacios/${spaceId}/nomina`, {
        replace: true,
        state: {
          spaceName: routeState?.spaceName,
        },
      })
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo dar de baja a la persona.'))
      setDeletingPerson(false)
    }
  }

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
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
  const infoLabelClass = isDark
    ? 'text-[10px] font-normal text-white/75'
    : 'text-[10px] font-normal text-[#232D4F]'
  const infoValueClass = isDark
    ? 'text-[14px] font-medium text-white'
    : 'text-[14px] font-medium text-[#232D4F]'

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

  if (!person) {
    return null
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-[16px] font-semibold ${textClass}`}>
            {person.apellido}, {person.nombre}
          </h2>
          {routeState?.spaceName ? (
            <p className={`mt-1 text-sm ${detailTextClass}`}>{routeState.spaceName}</p>
          ) : null}
        </div>
      </div>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className={infoLabelClass}>DNI</p>
            <p className={infoValueClass}>{person.dni || 'Sin documento'}</p>
          </div>
          <div>
            <p className={infoLabelClass}>Fecha nacimiento</p>
            <p className={infoValueClass}>{formatLatinDate(person.fecha_nacimiento)}</p>
          </div>
          <div>
            <p className={infoLabelClass}>Género</p>
            <p className={infoValueClass}>{person.genero || '-'}</p>
          </div>
        </div>
        {person.es_indocumentado ? (
          <p className="mt-2 text-sm font-semibold text-[#E7BA61]">Indocumentado</p>
        ) : null}
      </article>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-[12px] font-semibold ${textClass}`}>
              Asistencia del período {currentPeriodLabel}
            </p>
            {person.asistencia_mes_actual ? (
              <div className={`mt-1 grid gap-1 text-[12px] ${detailTextClass}`}>
                <p className="font-semibold text-[#2E7D33]">Asistencia tomada</p>
                <p>
                  Registrada el{' '}
                  {formatAttendanceTimestamp(person.asistencia_mes_actual.fecha_toma_asistencia)}
                </p>
                <p>Por {person.asistencia_mes_actual.tomado_por || 'usuario no disponible'}</p>
              </div>
            ) : (
              <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                Todavía no se registró la asistencia mensual de esta persona.
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={Boolean(person.asistencia_mes_actual) || savingAttendance}
            onClick={() => void handleRegisterAttendance()}
            aria-label={
              person.asistencia_mes_actual
                ? 'Asistencia mensual ya tomada'
                : 'Tomar asistencia'
            }
            className={joinClasses(
              person.asistencia_mes_actual
                ? appButtonClass({ variant: 'success', size: 'sm' })
                : appButtonClass({ variant: 'primary', size: 'sm' }),
              person.asistencia_mes_actual ? 'h-9 w-9 rounded-full p-0' : undefined,
            )}
          >
            {savingAttendance ? (
              'Guardando...'
            ) : person.asistencia_mes_actual ? (
              <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
            ) : (
              'Tomar asistencia'
            )}
          </button>
        </div>
      </article>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <p className={`text-[12px] font-semibold ${textClass}`}>Prestaciones</p>
        <div className="mt-2 flex items-center gap-3">
          {person.badges.includes('Alimentación') ? (
            <span className={`inline-flex items-center gap-2 text-sm ${detailTextClass}`}>
              <FontAwesomeIcon icon={faUtensils} aria-hidden="true" />
              Alimentación
            </span>
          ) : null}
          {person.badges.includes('Actividades') ? (
            <span className={`inline-flex items-center gap-2 text-sm ${detailTextClass}`}>
              <FontAwesomeIcon icon={faUsers} aria-hidden="true" />
              Actividades ({person.cantidad_actividades})
            </span>
          ) : null}
        </div>
      </article>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <p className={`text-[12px] font-semibold ${textClass}`}>Actividades vinculadas</p>
          <button
            type="button"
            onClick={() =>
              navigate(`/app-org/espacios/${spaceId}/nomina/${nominaId}/actividades`, {
                state: {
                  spaceName: routeState?.spaceName,
                },
              })
            }
            className={appButtonClass({ variant: 'primary', size: 'sm' })}
          >
            <FontAwesomeIcon icon={faCirclePlus} aria-hidden="true" style={{ fontSize: 11 }} />
            Sumar a actividad
          </button>
        </div>
        {person.actividades.length === 0 ? (
          <p className={`mt-2 text-[12px] ${detailTextClass}`}>Sin actividades vinculadas.</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {groupLinkedActivities(person.actividades).map((categoriaGroup) => (
              <div
                key={categoriaGroup.categoria}
                className={`rounded-lg border p-3 ${
                  isDark ? 'border-white/20 bg-white/10' : 'border-slate-300 bg-white/85'
                }`}
              >
                <p className={`text-[12px] font-semibold ${textClass}`}>
                  {categoriaGroup.categoria}
                </p>
                {categoriaGroup.actividades.map((actividadGroup) => (
                  <div
                    key={`${categoriaGroup.categoria}-${actividadGroup.nombre}`}
                    className="mt-2 grid gap-1"
                  >
                    <p
                      className={`flex items-center gap-2 text-[12px] font-semibold ${detailTextClass}`}
                    >
                      <FontAwesomeIcon
                        icon={faUsers}
                        aria-hidden="true"
                        style={{ fontSize: 11 }}
                      />
                      {actividadGroup.nombre}
                    </p>
                    {actividadGroup.dias.map((diaGroup) => (
                      <div key={`${actividadGroup.nombre}-${diaGroup.nombre}`} className="pl-5">
                        <p className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}>
                          <FontAwesomeIcon
                            icon={faCalendarDay}
                            aria-hidden="true"
                            style={{ fontSize: 11 }}
                          />
                          <span className="font-medium">{diaGroup.nombre}</span>
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1 pl-5">
                          {diaGroup.horarios.map((horario) => (
                            <span
                              key={`${actividadGroup.nombre}-${diaGroup.nombre}-${horario}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] ${
                                isDark
                                  ? 'border-white/25 text-white/90'
                                  : 'border-slate-300 text-slate-700'
                              }`}
                            >
                              <FontAwesomeIcon
                                icon={faClock}
                                aria-hidden="true"
                                style={{ fontSize: 10 }}
                              />
                              {horario}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <p className={`text-[12px] font-semibold ${textClass}`}>Historial de asistencias</p>
        {history.length === 0 ? (
          <p className={`mt-2 text-[12px] ${detailTextClass}`}>Sin asistencias registradas.</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {history.map((registro) => (
              <div
                key={registro.id}
                className={`rounded-md border px-3 py-2 ${
                  isDark ? 'border-white/10 bg-[#1E2A47]/70' : 'border-slate-200 bg-slate-50/90'
                }`}
              >
                <p className={`text-[12px] font-semibold ${textClass}`}>
                  Período {registro.periodo_label}
                </p>
                <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                  Tomada el {formatAttendanceTimestamp(registro.fecha_toma_asistencia)}
                </p>
                <p className={`text-[12px] ${detailTextClass}`}>
                  Por {registro.tomado_por || 'usuario no disponible'}
                </p>
              </div>
            ))}
          </div>
        )}
      </article>

      <button
        type="button"
        onClick={() => setShowDeleteConfirm(true)}
        disabled={deletingPerson}
        className={joinClasses(
          appButtonClass({ variant: 'danger', size: 'lg', fullWidth: true }),
          'mt-1',
        )}
      >
        <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
        {deletingPerson ? 'Dando de baja...' : 'Dar de baja de la nómina'}
      </button>
      <ConfirmActionModal
        open={showDeleteConfirm}
        title="Confirmar baja de nomina"
        message={
          person ? `Se va a dar de baja a ${person.apellido}, ${person.nombre} de la nomina.` : ''
        }
        confirmLabel="Dar de baja"
        loading={deletingPerson}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDeletePerson()}
      />
    </section>
  )
}
