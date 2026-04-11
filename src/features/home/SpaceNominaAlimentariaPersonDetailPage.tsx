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
        setObservacionesDraft(detail.observaciones || '')
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
    setSavingObservaciones(true)
    try {
      const updated = await updateNominaPerson(spaceId, nominaId, {
        observaciones: observacionesDraft,
      })
      setPerson(updated)
      setObservacionesDraft(updated.observaciones || '')
      setToast({ tone: 'success', message: 'Observaciones guardadas.' })
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
  const hasLockedObservaciones = Boolean((person?.observaciones || '').trim())
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
      <AppToast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />

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

      <article className="rounded-xl border p-4" style={cardStyle}>
        <p className={`text-[12px] font-semibold ${textClass}`}>Observaciones</p>
        <textarea
          value={observacionesDraft}
          onChange={(event) => setObservacionesDraft(event.target.value)}
          rows={4}
          disabled={hasLockedObservaciones}
          className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none ${
            isDark
              ? 'border-white/20 bg-white/10 text-white placeholder:text-white/60'
              : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400'
          }`}
          placeholder="Agregar observaciones de la persona"
        />
        {!hasLockedObservaciones ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveObservaciones()}
              disabled={savingObservaciones}
              className={joinClasses(
                appButtonClass({ variant: 'success', size: 'sm' }),
                savingObservaciones ? 'cursor-not-allowed opacity-60' : undefined,
              )}
            >
              {savingObservaciones ? 'Guardando...' : 'Guardar observaciones'}
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
