import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faChevronUp, faMagnifyingGlass, faUsers } from '@fortawesome/free-solid-svg-icons'
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
import { appButtonClass, joinClasses } from '../../ui/buttons'
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

function normalizeSearchValue(value: string | number | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

type PickerOption = {
  value: string
  label: string
}

const TIME_OPTIONS: PickerOption[] = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const minute = String(totalMinutes % 60).padStart(2, '0')
  const value = `${hour}:${minute}`
  return { value, label: value }
})

function SelectorField({
  label,
  value,
  placeholder,
  options,
  onChange,
  isDark,
}: {
  label: string
  value: string
  placeholder: string
  options: PickerOption[]
  onChange: (value: string) => void
  isDark: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  const titleClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailClass = isDark ? 'text-white/80' : 'text-slate-600'
  const panelClass = isDark ? 'border-white/20 bg-[#1E2846]' : 'border-slate-200 bg-white'

  return (
    <div className="grid min-w-0 gap-1">
      <span className={`text-[11px] font-semibold ${titleClass}`}>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-[42px] w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
          isDark
            ? 'border-white/30 bg-[#1E2846] text-white'
            : 'border-slate-300 bg-white text-slate-700'
        }`}
      >
        <span className={`min-w-0 break-words ${selected ? '' : detailClass}`}>
          {selected?.label || placeholder}
        </span>
        <FontAwesomeIcon
          icon={open ? faChevronUp : faChevronDown}
          aria-hidden="true"
          className="shrink-0"
          style={{ fontSize: 12 }}
        />
      </button>
      {open ? (
        <div className={`grid max-h-52 min-w-0 gap-1 overflow-auto rounded-lg border p-1 ${panelClass}`}>
          {options.map((option) => {
            const selectedOption = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`min-w-0 rounded-md px-2 py-2 text-left text-xs font-semibold break-words ${
                  selectedOption
                    ? 'bg-[#232D4F] text-white'
                    : isDark
                      ? 'text-white hover:bg-white/10'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function normalizeTimeValue(value: string | null | undefined): string {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }
  const match = rawValue.match(/^(\d{2}):(\d{2})/)
  if (!match) {
    return ''
  }
  return `${match[1]}:${match[2]}`
}

function isValidTimeValue(value: string | null | undefined): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim())
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function timeOptionsWithValue(value: string): PickerOption[] {
  if (!isValidTimeValue(value) || TIME_OPTIONS.some((option) => option.value === value)) {
    return TIME_OPTIONS
  }
  return [...TIME_OPTIONS, { value, label: value }].sort(
    (a, b) => timeToMinutes(a.value) - timeToMinutes(b.value),
  )
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
  const [nominaSearchTerm, setNominaSearchTerm] = useState('')
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
    responsable_actividad: '',
    vigencia_actividad_meses: '',
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

  const nominaById = useMemo(() => new Map(nominaRows.map((row) => [row.id, row])), [nominaRows])
  const enrolledNominaSet = useMemo(
    () => new Set(enrollees.filter((item) => item.activo).map((item) => item.nomina)),
    [enrollees],
  )
  const filteredNominaRows = useMemo(() => {
    const query = normalizeSearchValue(nominaSearchTerm)
    const numericQuery = nominaSearchTerm.replace(/\D/g, '')
    if (!query && !numericQuery) {
      return nominaRows
    }
    return nominaRows.filter((person) => {
      const lastName = normalizeSearchValue(person.apellido)
      const dni = normalizeSearchValue(person.dni)
      const dniDigits = String(person.dni || '').replace(/\D/g, '')
      return (
        lastName.includes(query) ||
        dni.includes(query) ||
        (numericQuery ? dniDigits.includes(numericQuery) : false)
      )
    })
  }, [nominaRows, nominaSearchTerm])
  const activityOptions = useMemo(
    () =>
      catalog.map((item) => ({
        value: String(item.id),
        label: `${item.categoria} - ${item.actividad}`,
      })),
    [catalog],
  )
  const dayOptions = useMemo(
    () =>
      days.map((item) => ({
        value: String(item.id),
        label: item.nombre,
      })),
    [days],
  )

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
        hora_inicio: normalizeTimeValue(selected.hora_inicio),
        hora_fin: normalizeTimeValue(selected.hora_fin),
        responsable_actividad: selected.responsable_actividad || '',
        vigencia_actividad_meses: selected.vigencia_actividad_meses
          ? String(selected.vigencia_actividad_meses)
          : '',
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
    if (
      !editForm.catalogo_actividad ||
      !editForm.dia_actividad ||
      !isValidTimeValue(editForm.hora_inicio) ||
      !isValidTimeValue(editForm.hora_fin)
    ) {
      setFormError('Completa todos los campos de la actividad.')
      return
    }
    if (timeToMinutes(editForm.hora_fin) <= timeToMinutes(editForm.hora_inicio)) {
      setFormError('La hora de fin debe ser posterior a la hora de inicio.')
      return
    }
    if (
      editForm.vigencia_actividad_meses
      && Number(editForm.vigencia_actividad_meses) < 1
    ) {
      setFormError('La vigencia debe ser mayor a 0 meses.')
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
        responsable_actividad: editForm.responsable_actividad.trim(),
        vigencia_actividad_meses: editForm.vigencia_actividad_meses
          ? Number(editForm.vigencia_actividad_meses)
          : null,
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
      setErrorMessage(parseApiError(error, 'No se pudo inactivar la actividad.'))
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
    <section className="grid min-w-0 gap-3 pb-20">
      <article className="min-w-0 rounded-xl border p-4" style={cardStyle}>
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
            <span className={`font-semibold ${textClass}`}>Responsable:</span>{' '}
            {activity.responsable_actividad || 'Sin dato'}
          </p>
          <p>
            <span className={`font-semibold ${textClass}`}>Vigencia:</span>{' '}
            {activity.vigencia_actividad_meses
              ? `${activity.vigencia_actividad_meses} meses`
              : 'Sin dato'}
          </p>
          <p>
            <span className={`font-semibold ${textClass}`}>Estado:</span>{' '}
            {activity.activo ? 'Activa' : 'Inactiva'}
          </p>
          <p>
            <span className={`font-semibold ${textClass}`}>Inscriptos:</span> {enrollees.length}
          </p>
        </div>
        {activity.activo ? (
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
            Inactivar actividad
          </button>
        </div>
        ) : null}
      </article>

      {isEditing && activity.activo ? (
        <article className="min-w-0 rounded-xl border p-3 sm:p-4" style={cardStyle}>
          <p className={`text-[12px] font-semibold ${textClass}`}>Editar actividad</p>
          <div className="mt-3 grid min-w-0 gap-2">
            <SelectorField
              label="Disciplina/actividad"
              value={editForm.catalogo_actividad}
              placeholder="Seleccioná una actividad"
              options={activityOptions}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, catalogo_actividad: value }))
              }
              isDark={isDark}
            />
            <SelectorField
              label="Día"
              value={editForm.dia_actividad}
              placeholder="Seleccioná un día"
              options={dayOptions}
              onChange={(value) => setEditForm((current) => ({ ...current, dia_actividad: value }))}
              isDark={isDark}
            />
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
              <SelectorField
                label="Hora inicio"
                value={editForm.hora_inicio}
                placeholder="Seleccioná hora"
                options={timeOptionsWithValue(editForm.hora_inicio)}
                onChange={(value) => setEditForm((current) => ({ ...current, hora_inicio: value }))}
                isDark={isDark}
              />
              <SelectorField
                label="Hora fin"
                value={editForm.hora_fin}
                placeholder="Seleccioná hora"
                options={timeOptionsWithValue(editForm.hora_fin)}
                onChange={(value) => setEditForm((current) => ({ ...current, hora_fin: value }))}
                isDark={isDark}
              />
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
              <label className="grid min-w-0 gap-1">
                <span className={`text-[11px] font-semibold ${textClass}`}>
                  Responsable de actividad
                </span>
                <input
                  type="text"
                  value={editForm.responsable_actividad}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      responsable_actividad: event.target.value,
                    }))
                  }
                  placeholder="Nombre y apellido"
                  className={joinClasses(
                    'min-h-[42px] rounded-lg border px-3 py-2 text-sm outline-none',
                    isDark
                      ? 'border-white/30 bg-[#1E2846] text-white placeholder:text-white/45'
                      : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400',
                  )}
                />
              </label>
              <label className="grid min-w-0 gap-1">
                <span className={`text-[11px] font-semibold ${textClass}`}>
                  Vigencia de actividad
                </span>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={editForm.vigencia_actividad_meses}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      vigencia_actividad_meses: event.target.value,
                    }))
                  }
                  placeholder="Meses"
                  className={joinClasses(
                    'min-h-[42px] rounded-lg border px-3 py-2 text-sm outline-none',
                    isDark
                      ? 'border-white/30 bg-[#1E2846] text-white placeholder:text-white/45'
                      : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400',
                  )}
                />
              </label>
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
            Historial de personas asociadas
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
                    {!item.activo ? (
                      <p className="mt-1 text-[11px] font-semibold text-[#7A1C1C]">
                        Baja histórica
                      </p>
                    ) : null}
                  </div>
                  {activity.activo && item.activo ? (
                    <button
                      type="button"
                      onClick={() => void handleRemoveEnrollee(item.nomina)}
                      disabled={savingBulk}
                      className={appButtonClass({ variant: 'danger', size: 'sm' })}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      {activity.activo ? (
      <article className="rounded-xl border p-4" style={cardStyle}>
        <p className={`text-[12px] font-semibold ${textClass}`}>Agregar desde nómina</p>
        <label className="sr-only" htmlFor="nomina-activity-search">
          Buscar por apellido o documento
        </label>
        <div
          className={`mt-3 flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 ${
            isDark
              ? 'border-white/30 bg-[#1E2846] text-white'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            aria-hidden="true"
            className={isDark ? 'text-white/70' : 'text-slate-500'}
            style={{ fontSize: 13 }}
          />
          <input
            id="nomina-activity-search"
            type="search"
            value={nominaSearchTerm}
            onChange={(event) => setNominaSearchTerm(event.target.value)}
            placeholder="Buscar por apellido o documento"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-inherit placeholder:opacity-60"
          />
        </div>
        {nominaRows.length === 0 ? (
          <p className={`mt-2 text-[12px] ${detailTextClass}`}>No hay beneficiarios en la nómina.</p>
        ) : filteredNominaRows.length === 0 ? (
          <p className={`mt-3 text-[12px] ${detailTextClass}`}>No hay resultados para esa búsqueda.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {filteredNominaRows.map((person) => {
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
                    {alreadyEnrolled ? (
                      <span className="grid h-5 w-5 shrink-0 place-items-center self-center rounded-full bg-[#2E7D33] text-white">
                        <FontAwesomeIcon icon={faCheck} aria-hidden="true" style={{ fontSize: 11 }} />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={pendingAddNominaIds.includes(person.id)}
                        disabled={savingBulk}
                        onChange={(event) => togglePendingAdd(person.id, event.target.checked)}
                        className="mt-1 h-5 w-5 accent-[#2E7D33]"
                      />
                    )}
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
      ) : null}

      <ConfirmActionModal
        open={showDeleteConfirm}
        title="Confirmar inactivacion"
        message={`Se va a inactivar la actividad "${activity.actividad}". El historial de personas asociadas queda disponible.`}
        confirmLabel="Inactivar actividad"
        loading={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDeleteActivity()}
      />
    </section>
  )
}
