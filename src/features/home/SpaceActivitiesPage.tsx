import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faClock,
  faPlus,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import {
  createSpaceActivity,
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
import { appButtonClass, joinClasses } from '../../ui/buttons'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

type FormState = {
  catalogo_actividad: string
}

type ScheduleRow = {
  dia_actividad: string
  hora_inicio: string
  hora_fin: string
}

const EMPTY_FORM: FormState = {
  catalogo_actividad: '',
}

const EMPTY_SCHEDULE_ROW: ScheduleRow = {
  dia_actividad: '',
  hora_inicio: '',
  hora_fin: '',
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

function formatScheduleRange(startTime: string, endTime: string): string {
  if (!startTime || !endTime) {
    return ''
  }
  return `${startTime} a ${endTime}`
}

function formatDurationLabel(startTime: string | null | undefined, endTime: string | null | undefined): string {
  const start = normalizeTimeValue(startTime)
  const end = normalizeTimeValue(endTime)
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

function getScheduleBounds(item: SpaceActivityItem): { hora_inicio: string; hora_fin: string } {
  const start = normalizeTimeValue(item.hora_inicio)
  const end = normalizeTimeValue(item.hora_fin)
  if (start && end) {
    return { hora_inicio: start, hora_fin: end }
  }

  const match = item.horario_actividad.match(/^(\d{2}:\d{2})\s*a\s*(\d{2}:\d{2})$/)
  if (match) {
    return { hora_inicio: match[1], hora_fin: match[2] }
  }

  return { hora_inicio: start, hora_fin: end }
}

function hasScheduleOverlap(rows: ScheduleRow[], catalogoActividad: string): boolean {
  if (!catalogoActividad) {
    return false
  }
  const grouped = new Map<string, Array<{ start: number; end: number }>>()

  for (const row of rows) {
    if (!row.dia_actividad || !row.hora_inicio || !row.hora_fin) {
      continue
    }
    const [startHour, startMinute] = row.hora_inicio.split(':').map(Number)
    const [endHour, endMinute] = row.hora_fin.split(':').map(Number)
    const startValue = startHour * 60 + startMinute
    const endValue = endHour * 60 + endMinute
    const currentRows = grouped.get(row.dia_actividad) || []
    currentRows.push({ start: startValue, end: endValue })
    grouped.set(row.dia_actividad, currentRows)
  }

  for (const dayRows of grouped.values()) {
    const orderedRows = [...dayRows].sort((a, b) => a.start - b.start)
    for (let index = 1; index < orderedRows.length; index += 1) {
      if (orderedRows[index].start < orderedRows[index - 1].end) {
        return true
      }
    }
  }

  return false
}

export function SpaceActivitiesPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()

  const [activities, setActivities] = useState<SpaceActivityItem[]>([])
  const [catalog, setCatalog] = useState<ActivityCatalogItem[]>([])
  const [days, setDays] = useState<ActivityDayItem[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [expandedActivityGroups, setExpandedActivityGroups] = useState<Record<string, boolean>>({})
  const [expandedDayGroups, setExpandedDayGroups] = useState<Record<string, boolean>>({})
  const [expandedHourIds, setExpandedHourIds] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([EMPTY_SCHEDULE_ROW])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [listCategoryFilter, setListCategoryFilter] = useState('TODAS')
  const [selectedAgendaDayId, setSelectedAgendaDayId] = useState<number | null>(null)
  const [expandedAgendaActivities, setExpandedAgendaActivities] = useState<Record<string, boolean>>({})
  const [enrolleesByActivity, setEnrolleesByActivity] = useState<Record<number, SpaceActivityEnrollee[]>>({})
  const [loadingEnrolleesIds, setLoadingEnrolleesIds] = useState<Record<number, boolean>>({})
  const [activityPendingDelete, setActivityPendingDelete] = useState<SpaceActivityItem | null>(null)
  const [deletingActivityId, setDeletingActivityId] = useState<number | null>(null)

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
  const detailTextClass = isDark ? 'text-white/90' : 'text-slate-700'
  const subCardClass = isDark ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white/80'
  const listNestedCardClass = isDark ? 'border-white/20 bg-[#1E2846]' : 'border-[#E0E0E0] bg-white'

  useEffect(() => {
    let isMounted = true

    async function loadAll() {
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')

      if (!spaceId) {
        setErrorMessage('No se encontro el espacio seleccionado.')
        setLoading(false)
        setPageLoading(false)
        return
      }

      try {
        const [catalogRes, daysRes, activitiesRes] = await Promise.all([
          listActivityCatalog(spaceId),
          listActivityDays(spaceId),
          listSpaceActivities(spaceId),
        ])
        if (!isMounted) {
          return
        }
        setCatalog(catalogRes)
        setDays(daysRes)
        setActivities(activitiesRes)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudieron cargar las actividades.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadAll()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [setPageLoading, spaceId])

  const submitLabel = editingId ? 'Guardar cambios' : 'Guardar actividad'
  const panelTitle = editingId ? 'Editar actividad' : 'Alta de actividad'

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((item) => item.categoria))).sort((a, b) => a.localeCompare(b)),
    [catalog],
  )
  const filteredCatalog = useMemo(
    () => (selectedCategory ? catalog.filter((item) => item.categoria === selectedCategory) : []),
    [catalog, selectedCategory],
  )
  const listFilterCategories = useMemo(
    () => ['TODAS', ...Array.from(new Set(activities.map((item) => item.categoria))).sort((a, b) => a.localeCompare(b))],
    [activities],
  )
  const filteredActivities = useMemo(
    () => (listCategoryFilter === 'TODAS' ? activities : activities.filter((item) => item.categoria === listCategoryFilter)),
    [activities, listCategoryFilter],
  )
  const dayOrderMap = useMemo(
    () =>
      new Map(
        days.map((item, index) => [item.nombre, index]),
      ),
    [days],
  )
  const groupedActivities = useMemo(() => {
    const byCategory = new Map<string, Map<string, SpaceActivityItem[]>>()
    for (const item of filteredActivities) {
      const categoryKey = item.categoria || 'Sin categoria'
      const activityKey = item.actividad || 'Sin actividad'
      if (!byCategory.has(categoryKey)) {
        byCategory.set(categoryKey, new Map<string, SpaceActivityItem[]>())
      }
      const byActivity = byCategory.get(categoryKey)!
      if (!byActivity.has(activityKey)) {
        byActivity.set(activityKey, [])
      }
      byActivity.get(activityKey)!.push(item)
    }

    return Array.from(byCategory.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([categoria, activityMap]) => ({
        categoria,
        actividades: Array.from(activityMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([actividad, items]) => {
            const orderedItems = [...items].sort((a, b) => {
              const dayCompare =
                (dayOrderMap.get(a.dia_actividad_nombre) ?? 999) -
                (dayOrderMap.get(b.dia_actividad_nombre) ?? 999)
              if (dayCompare !== 0) {
                return dayCompare
              }
              return (a.hora_inicio || '').localeCompare(b.hora_inicio || '')
            })
            const dayMap = new Map<string, SpaceActivityItem[]>()
            for (const row of orderedItems) {
              const dayKey = row.dia_actividad_nombre || 'Sin día'
              if (!dayMap.has(dayKey)) {
                dayMap.set(dayKey, [])
              }
              dayMap.get(dayKey)!.push(row)
            }
            return {
              actividad,
              items: orderedItems,
              dias: Array.from(dayMap.entries())
                .sort((a, b) => (dayOrderMap.get(a[0]) ?? 999) - (dayOrderMap.get(b[0]) ?? 999))
                .map(([dia, dayItems]) => ({
                  dia,
                  items: dayItems,
                })),
            }
          }),
      }))
  }, [dayOrderMap, filteredActivities])
  const weeklyAgenda = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        items: filteredActivities
          .filter((item) => item.dia_actividad === day.id)
          .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')),
      })),
    [days, filteredActivities],
  )
  const weeklyAgendaGrouped = useMemo(
    () =>
      weeklyAgenda.map((day) => {
        const groupedMap = new Map<
          string,
          {
            actividad: string
            categoria: string
            totalInscriptos: number
            slots: SpaceActivityItem[]
          }
        >()

        for (const item of day.items) {
          const groupKey = `${item.categoria}||${item.actividad}`
          if (!groupedMap.has(groupKey)) {
            groupedMap.set(groupKey, {
              actividad: item.actividad,
              categoria: item.categoria,
              totalInscriptos: 0,
              slots: [],
            })
          }
          const group = groupedMap.get(groupKey)!
          group.slots.push(item)
          group.totalInscriptos += item.cantidad_inscriptos
        }

        return {
          ...day,
          grupos: Array.from(groupedMap.values()).sort((a, b) =>
            a.actividad.localeCompare(b.actividad),
          ),
        }
      }),
    [weeklyAgenda],
  )
  const selectedAgendaDay =
    weeklyAgendaGrouped.find((day) => day.id === selectedAgendaDayId) ||
    weeklyAgendaGrouped.find((day) => day.grupos.length > 0) ||
    weeklyAgendaGrouped[0] ||
    null
  const selectedAgendaIndex = selectedAgendaDay
    ? weeklyAgendaGrouped.findIndex((day) => day.id === selectedAgendaDay.id)
    : -1

  useEffect(() => {
    if (!selectedAgendaDay && selectedAgendaDayId !== null) {
      setSelectedAgendaDayId(null)
      return
    }
    if (selectedAgendaDay && selectedAgendaDay.id !== selectedAgendaDayId) {
      setSelectedAgendaDayId(selectedAgendaDay.id)
    }
  }, [selectedAgendaDay, selectedAgendaDayId])

  function openCreateForm() {
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setScheduleRows([EMPTY_SCHEDULE_ROW])
    setSelectedCategory('')
    setFormError('')
    setFormOpen(true)
  }

  function openEditForm(item: SpaceActivityItem) {
    const category = catalog.find((catalogItem) => catalogItem.id === item.catalogo_actividad)?.categoria || ''
    const scheduleBounds = getScheduleBounds(item)
    setEditingId(item.id)
    setFormData({
      catalogo_actividad: String(item.catalogo_actividad),
    })
    setScheduleRows([
      {
        dia_actividad: String(item.dia_actividad),
        hora_inicio: scheduleBounds.hora_inicio,
        hora_fin: scheduleBounds.hora_fin,
      },
    ])
    setSelectedCategory(category)
    setFormError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setScheduleRows([EMPTY_SCHEDULE_ROW])
    setSelectedCategory('')
    setFormError('')
  }

  function validateForm(): string {
    if (!formData.catalogo_actividad) {
      return 'Selecciona una actividad.'
    }
    if (scheduleRows.length === 0) {
      return 'Agrega al menos un dia y horario.'
    }
    const invalidRow = scheduleRows.some((row) => !row.dia_actividad || !row.hora_inicio || !row.hora_fin)
    if (invalidRow) {
      return 'Completa todos los dias y horarios.'
    }
    const invalidRange = scheduleRows.some((row) => row.hora_fin <= row.hora_inicio)
    if (invalidRange) {
      return 'La hora de fin debe ser posterior a la hora de inicio.'
    }
    if (hasScheduleOverlap(scheduleRows, formData.catalogo_actividad)) {
      return 'La misma actividad no puede tener horarios cruzados en el mismo día.'
    }
    return ''
  }

  function updateScheduleRow(index: number, patch: Partial<ScheduleRow>) {
    setScheduleRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  function addScheduleRow() {
    setScheduleRows((current) => [...current, { ...EMPTY_SCHEDULE_ROW }])
  }

  function removeScheduleRow(index: number) {
    setScheduleRows((current) => {
      if (current.length <= 1) {
        return current
      }
      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  async function refreshActivities() {
    if (!spaceId) {
      return
    }
    const rows = await listSpaceActivities(spaceId)
    setActivities(rows)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }
    if (!spaceId) {
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const basePayload = {
        catalogo_actividad: Number(formData.catalogo_actividad),
      }
      const normalizedSchedules = scheduleRows.map((row) => ({
        dia_actividad: Number(row.dia_actividad),
        hora_inicio: row.hora_inicio,
        hora_fin: row.hora_fin,
      }))
      const uniqueSchedules = Array.from(
        new Map(
          normalizedSchedules.map((schedule) => [
            `${schedule.dia_actividad}-${schedule.hora_inicio}-${schedule.hora_fin}`,
            schedule,
          ]),
        ).values(),
      )

      if (editingId) {
        const [firstSchedule, ...otherSchedules] = uniqueSchedules
        await updateSpaceActivity(spaceId, editingId, {
          ...basePayload,
          ...firstSchedule,
        })
        await Promise.all(
          otherSchedules.map((schedule) =>
            createSpaceActivity(spaceId, {
              ...basePayload,
              ...schedule,
            })),
        )
      } else {
        await Promise.all(
          uniqueSchedules.map((schedule) =>
            createSpaceActivity(spaceId, {
              ...basePayload,
              ...schedule,
            })),
        )
      }
      await refreshActivities()
      closeForm()
    } catch (error) {
      setFormError(parseApiError(error, 'No se pudo guardar la actividad.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: SpaceActivityItem) {
    if (!spaceId || deletingActivityId === item.id) {
      return
    }
    setDeletingActivityId(item.id)
    try {
      await deleteSpaceActivity(spaceId, item.id)
      await refreshActivities()
      setActivityPendingDelete(null)
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo dar de baja la actividad.'))
    } finally {
      setDeletingActivityId(null)
    }
  }

  function toggleActivityGroup(groupKey: string) {
    setExpandedActivityGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }))
  }

  function toggleDay(dayKey: string) {
    setExpandedDayGroups((current) => ({
      ...current,
      [dayKey]: !current[dayKey],
    }))
  }

  function toggleAgendaActivity(activityKey: string) {
    setExpandedAgendaActivities((current) => ({
      ...current,
      [activityKey]: !current[activityKey],
    }))
  }

  function goToAgendaOffset(offset: number) {
    if (selectedAgendaIndex < 0) {
      return
    }
    const nextIndex = selectedAgendaIndex + offset
    if (nextIndex < 0 || nextIndex >= weeklyAgendaGrouped.length) {
      return
    }
    setSelectedAgendaDayId(weeklyAgendaGrouped[nextIndex].id)
  }

  async function toggleHour(activityId: number) {
    const willExpand = !expandedHourIds[activityId]
    setExpandedHourIds((current) => ({
      ...current,
      [activityId]: willExpand,
    }))

    if (!willExpand || enrolleesByActivity[activityId] || !spaceId) {
      return
    }

    setLoadingEnrolleesIds((current) => ({ ...current, [activityId]: true }))
    try {
      const rows = await listActivityEnrollees(spaceId, activityId)
      setEnrolleesByActivity((current) => ({ ...current, [activityId]: rows }))
    } catch {
      setEnrolleesByActivity((current) => ({ ...current, [activityId]: [] }))
    } finally {
      setLoadingEnrolleesIds((current) => ({ ...current, [activityId]: false }))
    }
  }

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

  return (
    <section className="pb-24">
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Actividades del Espacio</h2>
      </div>

      {formOpen ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className={`mt-3 grid gap-2 rounded-xl border p-3 ${subCardClass}`}
          style={cardStyle}
        >
          <p className={`text-sm font-semibold ${textClass}`}>{panelTitle}</p>

          <div className="grid gap-2">
            <p className={`text-xs font-semibold ${textClass}`}>Tipo de actividad</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                    onClick={() => {
                      const nextCategory = selectedCategory === category ? '' : category
                      setSelectedCategory(nextCategory)
                      setFormData((current) => ({ ...current, catalogo_actividad: '' }))
                    }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    selectedCategory === category
                      ? 'border-[#E7BA61] bg-[#232D4F] text-white'
                      : isDark
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className={`max-h-[190px] overflow-auto rounded-lg border p-2 ${isDark ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white'}`}>
            <p className={`mb-2 text-xs font-semibold ${textClass}`}>Actividad</p>
            {!selectedCategory ? (
              <p className={`text-xs ${detailTextClass}`}>Selecciona primero un tipo.</p>
            ) : filteredCatalog.length === 0 ? (
              <p className={`text-xs ${detailTextClass}`}>No hay actividades para ese tipo.</p>
            ) : (
              <div className="grid gap-1">
                {filteredCatalog.map((item) => {
                  const checked = formData.catalogo_actividad === String(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setFormData((current) => ({
                          ...current,
                          catalogo_actividad: checked ? '' : String(item.id),
                        }))
                      }
                      className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs ${
                        checked
                          ? 'border-[#E7BA61] bg-[#E7BA61]/20'
                          : isDark
                            ? 'border-white/20 bg-white/5'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <span className={textClass}>{item.actividad}</span>
                      <span
                        className={`ml-2 flex h-4 w-4 items-center justify-center rounded border ${
                          checked ? 'border-[#232D4F] bg-[#232D4F] text-white' : isDark ? 'border-white/50' : 'border-slate-400'
                        }`}
                      >
                        {checked ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" style={{ fontSize: 9 }} /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold ${textClass}`}>Dias y horarios</p>
            </div>
            <div className="grid gap-2">
              {scheduleRows.map((row, index) => (
                <div key={`schedule-${index}`} className={`grid grid-cols-1 gap-2 rounded-lg border p-2 ${subCardClass}`}>
                  <select
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                    value={row.dia_actividad}
                    onChange={(event) => updateScheduleRow(index, { dia_actividad: event.target.value })}
                  >
                    <option value="">Selecciona dia</option>
                    {days.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombre}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1">
                      <span className={`text-[11px] font-semibold ${textClass}`}>Hora de inicio</span>
                      <input
                        type="time"
                        value={row.hora_inicio}
                        onChange={(event) => updateScheduleRow(index, { hora_inicio: event.target.value })}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className={`text-[11px] font-semibold ${textClass}`}>Hora de fin</span>
                      <input
                        type="time"
                        value={row.hora_fin}
                        onChange={(event) => updateScheduleRow(index, { hora_fin: event.target.value })}
                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[11px] ${detailTextClass}`}>
                      {row.hora_inicio && row.hora_fin
                        ? formatScheduleRange(row.hora_inicio, row.hora_fin)
                        : 'Completá el rango horario.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeScheduleRow(index)}
                      disabled={scheduleRows.length <= 1}
                      className={appButtonClass({ variant: 'danger', size: 'sm' })}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addScheduleRow}
              className={joinClasses(
                appButtonClass({ variant: 'outline-secondary', size: 'md', fullWidth: true }),
                isDark ? 'border-white/40 text-white hover:bg-white/10' : 'border-[#232D4F] text-[#232D4F]',
              )}
            >
              + Agregar rango horario
            </button>
          </div>

          {formError ? <p className="text-xs text-[#C62828]">{formError}</p> : null}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className={joinClasses(
                appButtonClass({ variant: 'outline-secondary', size: 'sm' }),
                isDark ? 'border-white/40 text-white hover:bg-white/10' : undefined,
              )}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={appButtonClass({ variant: 'primary', size: 'sm' })}
            >
              {saving ? 'Guardando...' : submitLabel}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {listFilterCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setListCategoryFilter(category)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              listCategoryFilter === category
                ? 'border-[#E7BA61] bg-[#232D4F] text-white'
                : isDark
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <section className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" className={textClass} style={{ fontSize: 14 }} />
          <h3 className={`text-[14px] font-semibold ${textClass}`}>Agenda semanal</h3>
        </div>
        {selectedAgendaDay ? (
          <article className={`mt-3 rounded-2xl border p-3 ${subCardClass}`} style={cardStyle}>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToAgendaOffset(-1)}
                disabled={selectedAgendaIndex <= 0}
                className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                  isDark ? 'border-white/30 text-white' : 'border-slate-300 text-slate-700'
                } disabled:opacity-35`}
                aria-label="Día anterior"
              >
                <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" style={{ fontSize: 12 }} />
              </button>
              <div className="min-w-0 text-center">
                <p className={`text-[14px] font-semibold ${textClass}`}>{selectedAgendaDay.nombre}</p>
                <p className={`mt-1 text-[11px] ${detailTextClass}`}>
                  {selectedAgendaDay.grupos.length === 0
                    ? 'Sin actividades cargadas.'
                    : `${selectedAgendaDay.grupos.length} actividades programadas`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => goToAgendaOffset(1)}
                disabled={selectedAgendaIndex < 0 || selectedAgendaIndex >= weeklyAgendaGrouped.length - 1}
                className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                  isDark ? 'border-white/30 text-white' : 'border-slate-300 text-slate-700'
                } disabled:opacity-35`}
                aria-label="Día siguiente"
              >
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" style={{ fontSize: 12 }} />
              </button>
            </div>

            {selectedAgendaDay.grupos.length === 0 ? (
              <div className="mt-3 flex min-h-[72px] items-center rounded-xl border border-dashed border-slate-300/70 px-3 py-2">
                <p className={`text-[12px] ${detailTextClass}`}>Sin actividades cargadas.</p>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                {selectedAgendaDay.grupos.map((group) => {
                  const activityKey = `${selectedAgendaDay.id}-${group.categoria}-${group.actividad}`
                  return (
                    <div
                      key={`agenda-${activityKey}`}
                      className={`rounded-xl border ${isDark ? 'border-white/15 bg-[#1B2542]' : 'border-slate-200 bg-white'}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleAgendaActivity(activityKey)}
                        className="flex w-full items-start justify-between gap-3 p-3 text-left"
                        aria-label={
                          expandedAgendaActivities[activityKey]
                            ? `Ocultar ${group.actividad}`
                            : `Ver ${group.actividad}`
                        }
                      >
                        <div className="min-w-0">
                          <p className={`truncate text-[13px] font-semibold ${textClass}`}>{group.actividad}</p>
                          <p className={`mt-1 text-[11px] ${detailTextClass}`}>{group.categoria}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#E7BA61] px-2.5 py-1 text-[11px] font-semibold text-[#232D4F]">
                            {group.slots.length}
                          </span>
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                              isDark ? 'border-white/20 text-white' : 'border-slate-300 text-slate-700'
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={expandedAgendaActivities[activityKey] ? faChevronUp : faChevronDown}
                              aria-hidden="true"
                              style={{ fontSize: 12 }}
                            />
                          </span>
                        </div>
                      </button>
                      <div
                        className={`grid overflow-hidden transition-all duration-300 ease-out ${
                          expandedAgendaActivities[activityKey] ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="grid gap-2 px-3 pb-3">
                          <div className={`flex items-center gap-3 text-[11px] ${detailTextClass}`}>
                            <span>{group.totalInscriptos} inscriptos</span>
                          </div>
                          {group.slots.map((slot) => (
                            <div
                              key={`agenda-slot-${slot.id}`}
                              className={`rounded-lg border px-3 py-2 ${
                                isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] font-semibold ${textClass}`}>{slot.horario_actividad}</span>
                                <span className={`text-[11px] ${detailTextClass}`}>
                                  {formatDurationLabel(slot.hora_inicio, slot.hora_fin)}
                                </span>
                              </div>
                              <p className={`mt-1 text-[11px] ${detailTextClass}`}>
                                {slot.cantidad_inscriptos} inscriptos
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>
        ) : null}
      </section>

      {filteredActivities.length === 0 ? (
        <p className={`mt-3 text-sm ${detailTextClass}`}>No hay actividades para el filtro seleccionado.</p>
      ) : (
        <div className="mt-3 grid gap-4">
          {groupedActivities.map((categoryGroup, categoryIndex) => (
            <section
              key={categoryGroup.categoria}
              className="progressive-card grid gap-2"
              style={{ ['--card-delay' as string]: `${categoryIndex * 60}ms` }}
            >
              <h3 className={`text-[14px] font-semibold ${textClass}`}>{categoryGroup.categoria}</h3>

              <div className="grid gap-3">
                {categoryGroup.actividades.map((activityGroup, activityIndex) => (
                  <article
                    key={`${categoryGroup.categoria}-${activityGroup.actividad}`}
                    className="rounded-xl border p-3"
                    style={{
                      ...cardStyle,
                      ['--card-delay' as string]: `${categoryIndex * 60 + activityIndex * 40}ms`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleActivityGroup(`${categoryGroup.categoria}|${activityGroup.actividad}`)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                      aria-label={
                        expandedActivityGroups[`${categoryGroup.categoria}|${activityGroup.actividad}`]
                          ? 'Ocultar actividad'
                          : 'Ver actividad'
                      }
                    >
                      <div className={`min-w-0 text-[13px] ${detailTextClass}`}>
                        <p className={`truncate text-[14px] font-semibold ${textClass}`}>{activityGroup.actividad}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-[12px]">Turnos: {activityGroup.items.length}</p>
                          <p className="text-[12px]">
                            Duración: {formatDurationLabel(activityGroup.items[0]?.hora_inicio, activityGroup.items[0]?.hora_fin)}
                          </p>
                          <span className={`px-1 text-[11px] font-semibold ${textClass}`}>
                            <FontAwesomeIcon icon={faCalendarDays} aria-hidden="true" className="mr-1" style={{ fontSize: 12 }} />
                            {activityGroup.dias.length}
                          </span>
                          <span className={`px-1 text-[11px] font-semibold ${textClass}`}>
                            <FontAwesomeIcon icon={faUsers} aria-hidden="true" className="mr-1" style={{ fontSize: 12 }} />
                            {activityGroup.items.reduce((sum, item) => sum + item.cantidad_inscriptos, 0)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border ${isDark ? 'border-white/40 text-white' : 'border-slate-300 text-slate-700'}`}
                      >
                        <FontAwesomeIcon
                          icon={
                            expandedActivityGroups[`${categoryGroup.categoria}|${activityGroup.actividad}`]
                              ? faChevronUp
                              : faChevronDown
                          }
                          aria-hidden="true"
                          style={{ fontSize: 12 }}
                        />
                      </span>
                    </button>

                    <div
                      className={`grid overflow-hidden transition-all duration-300 ease-out ${
                        expandedActivityGroups[`${categoryGroup.categoria}|${activityGroup.actividad}`]
                          ? 'mt-2 max-h-[1500px] opacity-100'
                          : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="ml-1 pl-2">
                        {activityGroup.dias.map((dayGroup) => {
                        const dayKey = `${categoryGroup.categoria}|${activityGroup.actividad}|${dayGroup.dia}`
                        return (
                          <div key={dayKey} className={`mb-2 rounded-lg border p-2 ${listNestedCardClass}`}>
                            <button
                              type="button"
                              onClick={() => toggleDay(dayKey)}
                              className="flex w-full items-center justify-between text-left"
                              aria-label={expandedDayGroups[dayKey] ? 'Ocultar día' : 'Ver día'}
                            >
                              <p className={`text-[12px] ${detailTextClass}`}>
                                <span className={`font-semibold ${textClass}`}>Día:</span> {dayGroup.dia}
                              </p>
                              <div className="ml-auto flex items-center gap-2">
                                <span className={`px-1 text-[11px] font-semibold ${textClass}`}>
                                  <FontAwesomeIcon icon={faClock} aria-hidden="true" className="mr-1" style={{ fontSize: 12 }} />
                                  {dayGroup.items.length}
                                </span>
                                <span className={`px-1 text-[11px] font-semibold ${textClass}`}>
                                  <FontAwesomeIcon icon={faUsers} aria-hidden="true" className="mr-1" style={{ fontSize: 12 }} />
                                  {dayGroup.items.reduce((sum, item) => sum + item.cantidad_inscriptos, 0)}
                                </span>
                                <span
                                  className={`flex h-7 w-7 items-center justify-center rounded-full border ${isDark ? 'border-white/40 text-white' : 'border-slate-300 text-slate-700'}`}
                                >
                                  <FontAwesomeIcon
                                    icon={expandedDayGroups[dayKey] ? faChevronUp : faChevronDown}
                                    aria-hidden="true"
                                    style={{ fontSize: 12 }}
                                  />
                                </span>
                              </div>
                            </button>

                            <div
                              className={`grid overflow-hidden transition-all duration-300 ease-out ${
                                expandedDayGroups[dayKey] ? 'mt-2 max-h-[1400px] opacity-100' : 'max-h-0 opacity-0'
                              }`}
                            >
                              <div className="ml-1 grid gap-3 pl-2">
                                {dayGroup.items.map((activity) => (
                                  <div key={activity.id} className={`rounded-lg border p-2 ${subCardClass}`}>
                                    <button
                                      type="button"
                                      onClick={() => void toggleHour(activity.id)}
                                      className="flex w-full items-center justify-between text-left"
                                      aria-label={expandedHourIds[activity.id] ? 'Ocultar horario' : 'Ver horario'}
                                    >
                                      <p className={`text-[12px] ${detailTextClass}`}>
                                        <span className={`font-semibold ${textClass}`}>Horario:</span>{' '}
                                        {activity.horario_actividad}
                                      </p>
                                      <div className="ml-auto flex items-center gap-2">
                                        <span className={`px-1 text-[11px] font-semibold ${textClass}`}>
                                          <FontAwesomeIcon icon={faUsers} aria-hidden="true" className="mr-1" style={{ fontSize: 12 }} />
                                          {activity.cantidad_inscriptos}
                                        </span>
                                        <span
                                          className={`flex h-7 w-7 items-center justify-center rounded-full border ${isDark ? 'border-white/40 text-white' : 'border-slate-300 text-slate-700'}`}
                                        >
                                          <FontAwesomeIcon
                                            icon={expandedHourIds[activity.id] ? faChevronUp : faChevronDown}
                                            aria-hidden="true"
                                            style={{ fontSize: 12 }}
                                          />
                                        </span>
                                      </div>
                                    </button>
                                    <div
                                      className={`grid overflow-hidden transition-all duration-300 ease-out ${
                                        expandedHourIds[activity.id] ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'
                                      }`}
                                    >
                                      <div className="ml-1 mt-1 pl-2">
                                        <p className={`text-[12px] ${detailTextClass}`}>
                                          <span className={`font-semibold ${textClass}`}>Duración:</span>{' '}
                                          {formatDurationLabel(activity.hora_inicio, activity.hora_fin)}
                                        </p>
                                        <p className={`text-[12px] font-semibold ${textClass}`}>Listado de inscriptos</p>
                                        {loadingEnrolleesIds[activity.id] ? (
                                          <p className={`text-[12px] ${detailTextClass}`}>Cargando...</p>
                                        ) : (
                                          <div className="mt-1 grid gap-1">
                                            {(enrolleesByActivity[activity.id] || []).length === 0 ? (
                                              <p className={`text-[12px] ${detailTextClass}`}>Sin inscriptos.</p>
                                            ) : (
                                              (enrolleesByActivity[activity.id] || []).map((item) => (
                                                <p key={item.id} className={`text-[12px] ${detailTextClass}`}>
                                                  {item.apellido}, {item.nombre} - DNI {item.dni || '-'} -{' '}
                                                  {item.genero || '-'} - Nacimiento {item.fecha_nacimiento || '-'}
                                                </p>
                                              ))
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      <div className="mt-3 flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openEditForm(activity)}
                                          className={joinClasses(
                                            appButtonClass({
                                              variant: 'outline-secondary',
                                              size: 'sm',
                                            }),
                                            isDark
                                              ? 'border-white/40 bg-white text-[#232D4F]'
                                              : 'border-[#232D4F] text-[#232D4F]',
                                          )}
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActivityPendingDelete(activity)}
                                          disabled={deletingActivityId === activity.id}
                                          className={appButtonClass({ variant: 'danger', size: 'sm' })}
                                        >
                                          {deletingActivityId === activity.id ? 'Eliminando...' : 'Eliminar'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openCreateForm}
        className={joinClasses(
          appButtonClass({ variant: 'success', size: 'md' }),
          'fixed bottom-20 right-4 z-20 h-14 w-14 rounded-full p-0 shadow-[0_10px_24px_rgba(46,125,51,0.35)]',
        )}
        aria-label="Agregar actividad"
      >
        <FontAwesomeIcon icon={faPlus} aria-hidden="true" style={{ fontSize: 22 }} />
      </button>
      <ConfirmActionModal
        open={Boolean(activityPendingDelete)}
        title="Confirmar baja de actividad"
        message={
          activityPendingDelete
            ? `Se va a dar de baja la actividad "${activityPendingDelete.actividad}".`
            : ''
        }
        confirmLabel="Dar de baja"
        loading={Boolean(activityPendingDelete && deletingActivityId === activityPendingDelete.id)}
        onCancel={() => setActivityPendingDelete(null)}
        onConfirm={() =>
          activityPendingDelete ? void handleDelete(activityPendingDelete) : undefined
        }
      />
    </section>
  )
}
