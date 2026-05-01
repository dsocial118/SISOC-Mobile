import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import {
  deleteNominaPerson,
  getNominaPersonDetail,
  listNominaAttendanceHistory,
  updateNominaPerson,
  type NominaAttendanceRecord,
  type NominaPerson,
} from '../../api/nominaApi'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'
import { AppToast } from '../../ui/AppToast'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { appButtonClass, joinClasses } from '../../ui/buttons'

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

export function SpaceNominaAlimentariaPersonDetailPage() {
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
  const [deletingPerson, setDeletingPerson] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [observacionesDraft, setObservacionesDraft] = useState('')
  const [savingObservaciones, setSavingObservaciones] = useState(false)
  const [showAllAsistencias, setShowAllAsistencias] = useState(false)
  const [showAllObservaciones, setShowAllObservaciones] = useState(false)
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

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
        setObservacionesDraft('')
        setShowAllAsistencias(false)
        setShowAllObservaciones(false)
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

  async function handleDeletePerson() {
    if (!spaceId || !nominaId || !person || deletingPerson) {
      return
    }

    setDeletingPerson(true)
    setShowDeleteConfirm(false)
    setErrorMessage('')
    try {
      await deleteNominaPerson(spaceId, nominaId)
      navigate(`/app-org/espacios/${spaceId}/nomina-alimentaria`, {
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

  async function handleSaveObservaciones() {
    if (!spaceId || !nominaId || !person || savingObservaciones) {
      return
    }
    const nextObservacion = observacionesDraft.trim()
    if (!nextObservacion) {
      return
    }
    setSavingObservaciones(true)
    try {
      const updated = await updateNominaPerson(spaceId, nominaId, {
        observaciones: nextObservacion,
      })
      setPerson(updated)
      setObservacionesDraft('')
      setToast({ tone: 'success', message: 'Observación guardada.' })
    } catch (error) {
      setToast({
        tone: 'error',
        message: parseApiError(error, 'No se pudieron guardar las observaciones.'),
      })
    } finally {
      setSavingObservaciones(false)
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
        <div className="mt-4 rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 p-4 text-sm text-white">
          {errorMessage}
        </div>
      </section>
    )
  }

  if (!person) {
    return null
  }
  const observacionesHistorial = person.observaciones_historial ?? []
  const hasMoreObservaciones = observacionesHistorial.length > 2
  const visibleObservaciones = showAllObservaciones
    ? observacionesHistorial
    : observacionesHistorial.slice(0, 2)
  const hasMoreAsistencias = history.length > 2
  const visibleAsistencias = showAllAsistencias ? history : history.slice(0, 2)

  return (
    <section className="grid gap-3">
      <AppToast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />

      <article className="rounded-xl border p-4" style={cardStyle}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className={infoLabelClass}>DNI</p>
            <p className={infoValueClass}>{person.dni || 'Sin documento'}</p>
          </div>
          <div>
            <p className={infoLabelClass}>Fecha de nacimiento</p>
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
        <p className={`text-[12px] font-semibold ${textClass}`}>Historial de asistencias</p>
        {history.length === 0 ? (
          <p className={`mt-2 text-[12px] ${detailTextClass}`}>Sin asistencias registradas.</p>
        ) : (
          <div className={`mt-2 grid gap-2 ${showAllAsistencias ? 'max-h-52 overflow-y-auto pr-1' : ''}`}>
            {visibleAsistencias.map((registro) => (
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
        {hasMoreAsistencias ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllAsistencias((current) => !current)}
              className={appButtonClass({ variant: 'outline-secondary', size: 'sm' })}
            >
              {showAllAsistencias ? 'Ver menos' : 'Ver más'}
            </button>
          </div>
        ) : null}
      </article>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <p className={`text-[12px] font-semibold ${textClass}`}>Observaciones</p>
        <textarea
          value={observacionesDraft}
          onChange={(event) => setObservacionesDraft(event.target.value)}
          rows={4}
          className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
            isDark
              ? 'border-white/20 bg-white/10 text-white placeholder:text-white/60'
              : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400'
          }`}
          placeholder="Agregar nueva observación"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSaveObservaciones()}
            disabled={savingObservaciones || !observacionesDraft.trim()}
            className={joinClasses(
              appButtonClass({ variant: 'success', size: 'sm' }),
              savingObservaciones ? 'cursor-not-allowed opacity-60' : undefined,
            )}
          >
            {savingObservaciones ? 'Guardando...' : 'Agregar observación'}
          </button>
        </div>

        {observacionesHistorial.length > 0 ? (
          <div className={`mt-3 grid gap-2 ${showAllObservaciones ? 'max-h-52 overflow-y-auto pr-1' : ''}`}>
            {visibleObservaciones.map((item) => (
              <div
                key={item.id}
                className={`rounded-md border px-3 py-2 ${
                  isDark ? 'border-white/10 bg-[#1E2A47]/70' : 'border-slate-200 bg-slate-50/90'
                }`}
              >
                <p className={`text-[12px] ${detailTextClass}`}>{item.texto}</p>
                <p className={`mt-1 text-[11px] ${detailTextClass}`}>
                  {formatAttendanceTimestamp(item.fecha_creacion)} · {item.creada_por || 'usuario'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className={`mt-3 text-[12px] ${detailTextClass}`}>Sin observaciones registradas.</p>
        )}
        {hasMoreObservaciones ? (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllObservaciones((current) => !current)}
              className={appButtonClass({ variant: 'outline-secondary', size: 'sm' })}
            >
              {showAllObservaciones ? 'Ver menos' : 'Ver más'}
            </button>
          </div>
        ) : null}
      </article>

      <button
        type="button"
        onClick={() => setShowDeleteConfirm(true)}
        disabled={deletingPerson}
        className={joinClasses(
          'mt-1',
          appButtonClass({ variant: 'danger', size: 'lg', fullWidth: true }),
        )}
      >
        <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
        {deletingPerson ? 'Dando de baja...' : 'Dar de baja de beneficiarios'}
      </button>
      <ConfirmActionModal
        open={showDeleteConfirm}
        title="Confirmar baja de beneficiarios"
        message={
          person ? `Se va a dar de baja a ${person.apellido}, ${person.nombre} de beneficiarios.` : ''
        }
        confirmLabel="Dar de baja"
        loading={deletingPerson}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDeletePerson()}
      />
    </section>
  )
}



