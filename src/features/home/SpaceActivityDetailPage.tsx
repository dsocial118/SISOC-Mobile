import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUsers } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  deleteSpaceActivity,
  listActivityCatalog,
  listActivityDays,
  listActivityEnrollees,
  listSpaceActivities,
  updateSpaceActivity,
  type ActivityCatalogItem,
  type ActivityDayItem,
  type SpaceActivityEnrollee,
  type SpaceActivityItem,
} from '../../api/activitiesApi'
import { parseApiError } from '../../api/errorUtils'
import { listSpaceNomina, updateNominaPerson, type NominaPerson } from '../../api/nominaApi'
import { appButtonClass } from '../../ui/buttons'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

function formatDurationLabel(startTime: string | null | undefined, endTime: string | null | undefined): string {
  const start = String(startTime || '').trim()
  const end = String(endTime || '').trim()
  if (!start || !end) {
    return 'Sin dato'
  }
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const totalMinutes = endHour * 60 + endMinute - (startHour * 60 + startMinute)
  if (totalMinutes <= 0) {
    return 'Sin dato'
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`
  }
  if (hours > 0) {
    return hours === 1 ? '1 hora' : `${hours} horas`
  }
  return `${minutes} min`
}

function uniqueIds(values: number[]): number[] {
  return Array.from(new Set(values))
}

export function SpaceActivityDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId, activityId } = useParams<{ spaceId: string; activityId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as { spaceName?: string; programName?: string; projectName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [savingBulk, setSavingBulk] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activity, setActivity] = useState<SpaceActivityItem | null>(null)
  const [enrollees, setEnrollees] = useState<SpaceActivityEnrollee[]>([])
  const [nominaRows, setNominaRows] = useState<NominaPerson[]>([])
  const [pendingAddNominaIds, setPendingAddNominaIds] = useState<number[]>([])
  const [days, setDays] = useState<ActivityDayItem[]>([])
  const [catalog, setCatalog] = useState<ActivityCatalogItem[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [formError, setFormError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editForm, setEditForm] = useState({
    catalogo_actividad: '',
    dia_actividad: '',
    hora_inicio: '',
    hora_fin: '',
  })

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
  const subCardClass = isDark ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white'
  const inputClass = `rounded-md border px-2 py-2 text-sm ${
    isDark ? 'border-white/20 bg-[#1E2846] text-white' : 'border-slate-300 bg-white text-slate-800'
  }`

  const nominaById = useMemo(() => new Map(nominaRows.map((row) => [row.id, row])), [nominaRows])
  const enrolledNominaSet = useMemo(() => new Set(enrollees.map((item) => item.nomina)), [enrollees])

  async function loadAll() {
    if (!spaceId || !activityId) {
      return
    }
    const [activities, enrolled, nomina, dayRows, catalogRows] = await Promise.all([
      listSpaceActivities(spaceId),
      listActivityEnrollees(spaceId, activityId),
      listSpaceNomina(spaceId, { tab: 'consolidada' }),
      listActivityDays(spaceId),
      listActivityCatalog(spaceId),
    ])
    const selected = activities.find((item) => String(item.id) === String(activityId)) || null
    setActivity(selected)
    setEnrollees(enrolled)
    setNominaRows(nomina.results || [])
    setDays(dayRows)
    setCatalog(catalogRows)
    setPendingAddNominaIds([])
    if (selected) {
      setEditForm({
        catalogo_actividad: String(selected.catalogo_actividad),
        dia_actividad: String(selected.dia_actividad),
        hora_inicio: String(selected.hora_inicio || '').slice(0, 5),
        hora_fin: String(selected.hora_fin || '').slice(0, 5),
      })
    }
  }

  useEffect(() => {
    let isMounted = true
    async function bootstrap() {
      if (!spaceId || !activityId) {
        setErrorMessage('No se encontró la actividad seleccionada.')
        setLoading(false)
        return
      }
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        await loadAll()
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar el detalle de la actividad.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }
    void bootstrap()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [activityId, setPageLoading, spaceId])

  function togglePendingAdd(nominaId: number, checked: boolean) {
    setPendingAddNominaIds((current) => {
      if (checked) {
        return uniqueIds([...current, nominaId])
      }
      return current.filter((id) => id !== nominaId)
    })
  }

  async function handleBulkAdd() {
    if (!spaceId || !activity) {
      return
    }
    const addIds = pendingAddNominaIds.filter((id) => !enrolledNominaSet.has(id))
    if (addIds.length === 0) {
      return
    }

    setSavingBulk(true)
    setErrorMessage('')
    try {
      await Promise.all(
        addIds.map(async (nominaId) => {
          const person = nominaById.get(nominaId)
          if (!person) {
            return
          }
          const currentIds = uniqueIds((person.actividades || []).map((item) => item.actividad_id))
          const nextIds = uniqueIds([...currentIds, activity.id])
          await updateNominaPerson(spaceId, nominaId, {
            asistencia_actividades: nextIds.length > 0,
            actividad_ids: nextIds,
          })
        }),
      )
      await loadAll()
      setPendingAddNominaIds([])
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo actualizar la vinculación de la actividad.'))
    } finally {
      setSavingBulk(false)
    }
  }

  async function handleRemoveEnrollee(nominaId: number) {
    if (!spaceId || !activity || savingBulk) {
      return
    }
    const person = nominaById.get(nominaId)
    if (!person) {
      return
    }
    const currentIds = uniqueIds((person.actividades || []).map((item) => item.actividad_id))
    const nextIds = currentIds.filter((id) => id !== activity.id)
    setSavingBulk(true)
    setErrorMessage('')
    try {
      await updateNominaPerson(spaceId, nominaId, {
        asistencia_actividades: nextIds.length > 0,
        actividad_ids: nextIds,
      })
      await loadAll()
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo quitar la vinculación de la actividad.'))
    } finally {
      setSavingBulk(false)
    }
  }

  async function handleSaveEdit() {
    if (!spaceId || !activity) {
      return
    }
    if (!editForm.catalogo_actividad || !editForm.dia_actividad || !editForm.hora_inicio || !editForm.hora_fin) {
      setFormError('Completa todos los campos de la actividad.')
      return
    }
    if (editForm.hora_fin <= editForm.hora_inicio) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }
    setSavingEdit(true)
    setFormError('')
    setErrorMessage('')
    try {
      await updateSpaceActivity(spaceId, activity.id, {
        catalogo_actividad: Number(editForm.catalogo_actividad),
        dia_actividad: Number(editForm.dia_actividad),
        hora_inicio: editForm.hora_inicio,
        hora_fin: editForm.hora_fin,
      })
      await loadAll()
      setIsEditing(false)
    } catch (error) {
      setFormError(parseApiError(error, 'No se pudo editar la actividad.'))
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteActivity() {
    if (!spaceId || !activity || deleting) {
      return
    }
    setDeleting(true)
    setErrorMessage('')
    try {
      await deleteSpaceActivity(spaceId, activity.id)
      navigate(`/app-org/espacios/${spaceId}/actividades`, {
        replace: true,
        state: routeState || undefined,
      })
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo eliminar la actividad.'))
      setDeleting(false)
    }
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

  if (!activity) {
    return (
      <section>
        <div className="mt-4 rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 p-4 text-sm text-white">
          No se encontró la actividad seleccionada.
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-3 pb-20">
      <article className="rounded-xl border p-4" style={cardStyle}>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>{activity.actividad}</h2>
        <div className={`mt-2 grid gap-1 text-[13px] ${detailTextClass}`}>
          <p>
            <span className={`font-semibold ${textClass}`}>Disciplina:</span> {activity.categoria}
          </p>
          <p>
            <span className={`font-semibold ${textClass}`}>Día:</span> {activity.dia_actividad_nombre}
          </p>
          <p>
            <span className={`font-semibold ${textClass}`}>Horario:</span> {activity.horario_actividad}
          </p>
          <p>
            <span className={`font-semibold ${textClass}`}>Duración:</span>{' '}
            {formatDurationLabel(activity.hora_inicio, activity.hora_fin)}
          </p>
          <p>
            <span className={`font-semibold ${textClass}`}>Inscriptos:</span> {enrollees.length}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={appButtonClass({ variant: 'outline-secondary', size: 'sm', fullWidth: true })}
            onClick={() => {
              setIsEditing((current) => !current)
              setFormError('')
            }}
          >
            {isEditing ? 'Cerrar edición' : 'Editar actividad'}
          </button>
          <button
            type="button"
            className={appButtonClass({ variant: 'danger', size: 'sm', fullWidth: true })}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Eliminar actividad
          </button>
        </div>
      </article>

      {isEditing ? (
        <article className="rounded-xl border p-4" style={cardStyle}>
          <p className={`text-[12px] font-semibold ${textClass}`}>Editar actividad</p>
          <div className="mt-3 grid gap-2">
            <label className={`text-[12px] ${detailTextClass}`}>Disciplina/actividad</label>
            <select
              value={editForm.catalogo_actividad}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, catalogo_actividad: event.target.value }))
              }
              className={inputClass}
            >
              <option value="">Seleccioná una actividad</option>
              {catalog.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.categoria} · {item.actividad}
                </option>
              ))}
            </select>
            <label className={`text-[12px] ${detailTextClass}`}>Día</label>
            <select
              value={editForm.dia_actividad}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, dia_actividad: event.target.value }))
              }
              className={inputClass}
            >
              <option value="">Seleccioná un día</option>
              {days.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.nombre}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`text-[12px] ${detailTextClass}`}>Hora inicio</label>
                <input
                  type="time"
                  value={editForm.hora_inicio}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, hora_inicio: event.target.value }))
                  }
                  className={`mt-1 w-full ${inputClass}`}
                />
              </div>
              <div>
                <label className={`text-[12px] ${detailTextClass}`}>Hora fin</label>
                <input
                  type="time"
                  value={editForm.hora_fin}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, hora_fin: event.target.value }))
                  }
                  className={`mt-1 w-full ${inputClass}`}
                />
              </div>
            </div>
            {formError ? (
              <div className="rounded-lg border border-[#F2B8B5] bg-[#7A1C1C]/50 p-2 text-xs text-white">
                {formError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit}
              className={appButtonClass({ variant: 'success', size: 'sm', fullWidth: true })}
            >
              {savingEdit ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </article>
      ) : null}

      <article className="rounded-xl border p-4" style={cardStyle}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[12px] font-semibold ${textClass}`}>
            <FontAwesomeIcon icon={faUsers} aria-hidden="true" className="mr-2" />
            Inscriptos
          </p>
        </div>
        {enrollees.length === 0 ? (
          <p className={`mt-2 text-[12px] ${detailTextClass}`}>Sin inscriptos.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {enrollees.map((item) => (
              <div key={item.id} className={`rounded-lg border p-3 ${subCardClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[13px] font-semibold ${textClass}`}>
                      {item.apellido}, {item.nombre}
                    </p>
                    <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                      DNI {item.dni || '-'} · {item.genero || '-'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveEnrollee(item.nomina)}
                    disabled={savingBulk}
                    className={appButtonClass({ variant: 'danger', size: 'sm' })}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <p className={`text-[12px] font-semibold ${textClass}`}>Agregar desde nómina</p>
        {nominaRows.length === 0 ? (
          <p className={`mt-2 text-[12px] ${detailTextClass}`}>No hay beneficiarios en la nómina.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {nominaRows.map((person) => {
              const alreadyEnrolled = enrolledNominaSet.has(person.id)
              return (
                <label key={person.id} className={`rounded-lg border p-3 ${subCardClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-[13px] font-semibold ${textClass}`}>
                        {person.apellido}, {person.nombre}
                      </p>
                      <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                        DNI {person.dni || '-'} · {person.genero || '-'}
                      </p>
                      {alreadyEnrolled ? (
                        <p className="mt-1 text-[11px] font-semibold text-[#2E7D33]">Ya inscripto</p>
                      ) : null}
                    </div>
                    <input
                      type="checkbox"
                      checked={pendingAddNominaIds.includes(person.id)}
                      disabled={alreadyEnrolled || savingBulk}
                      onChange={(event) => togglePendingAdd(person.id, event.target.checked)}
                      className="mt-1 h-5 w-5 accent-[#2E7D33]"
                    />
                  </div>
                </label>
              )
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => void handleBulkAdd()}
          disabled={savingBulk}
          className={`mt-3 ${appButtonClass({ variant: 'success', size: 'sm', fullWidth: true })}`}
        >
          {savingBulk ? 'Guardando...' : 'Guardar selección'}
        </button>
      </article>

      <ConfirmActionModal
        open={showDeleteConfirm}
        title="Confirmar eliminación"
        message={`Se va a eliminar la actividad "${activity.actividad}".`}
        confirmLabel="Eliminar actividad"
        loading={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDeleteActivity()}
      />
    </section>
  )
}

