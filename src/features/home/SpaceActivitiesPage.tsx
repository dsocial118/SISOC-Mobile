import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarDays, faCheck, faChevronDown, faChevronUp, faClock, faUsers } from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
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
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

type FormState = {
  catalogo_actividad: string
}

type ScheduleRow = {
  dia_actividad: string
  horarios_actividad: string[]
}

const EMPTY_FORM: FormState = {
  catalogo_actividad: '',
}

const EMPTY_SCHEDULE_ROW: ScheduleRow = {
  dia_actividad: '',
  horarios_actividad: [],
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))

function normalizeHourSlot(value: string | null | undefined): string {
  const match = String(value || '').trim().match(/^(\d{1,2})/)
  if (!match) {
    return ''
  }
  const hour = Number(match[1])
  if (Number.isNaN(hour) || hour < 0 || hour > 23) {
    return ''
  }
  return String(hour).padStart(2, '0')
}

function parseApiError(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<Record<string, unknown>>
  const data = axiosError?.response?.data
  if (!data) {
    return fallback
  }
  if (typeof data.detail === 'string') {
    return data.detail
  }
  const firstEntry = Object.values(data)[0]
  if (Array.isArray(firstEntry) && firstEntry.length > 0) {
    return String(firstEntry[0])
  }
  if (typeof firstEntry === 'string') {
    return firstEntry
  }
  return fallback
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
  const [enrolleesByActivity, setEnrolleesByActivity] = useState<Record<number, SpaceActivityEnrollee[]>>({})
  const [loadingEnrolleesIds, setLoadingEnrolleesIds] = useState<Record<number, boolean>>({})

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
              const dayCompare = a.dia_actividad_nombre.localeCompare(b.dia_actividad_nombre)
              if (dayCompare !== 0) {
                return dayCompare
              }
              return a.horario_actividad.localeCompare(b.horario_actividad)
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
              dias: Array.from(dayMap.entries()).map(([dia, dayItems]) => ({
                dia,
                items: dayItems,
              })),
            }
          }),
      }))
  }, [filteredActivities])

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
    setEditingId(item.id)
    setFormData({
      catalogo_actividad: String(item.catalogo_actividad),
    })
    setScheduleRows([
      {
        dia_actividad: String(item.dia_actividad),
        horarios_actividad: [normalizeHourSlot(item.horario_actividad)].filter(Boolean),
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
    const invalidRow = scheduleRows.some((row) => !row.dia_actividad || row.horarios_actividad.length === 0)
    if (invalidRow) {
      return 'Completa todos los dias y horarios.'
    }
    const selectedDays = scheduleRows.map((row) => row.dia_actividad)
    if (new Set(selectedDays).size !== selectedDays.length) {
      return 'No se puede repetir el dia en la misma carga.'
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
      const normalizedSchedules = scheduleRows.flatMap((row) =>
        row.horarios_actividad.map((hour) => ({
          dia_actividad: Number(row.dia_actividad),
          horario_actividad: `${hour}:00`,
        })),
      )
      const uniqueSchedules = Array.from(
        new Map(
          normalizedSchedules.map((schedule) => [
            `${schedule.dia_actividad}-${schedule.horario_actividad}`,
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
    if (!spaceId) {
      return
    }
    const confirmed = window.confirm(`¿Dar de baja la actividad "${item.actividad}"?`)
    if (!confirmed) {
      return
    }
    try {
      await deleteSpaceActivity(spaceId, item.id)
      await refreshActivities()
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo dar de baja la actividad.'))
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
    <section>
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Actividades del Espacio</h2>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-full bg-[#2E7D33] px-3 py-1 text-xs font-semibold text-white"
        >
          + Agregar
        </button>
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
                    setFormData({ catalogo_actividad: '' })
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
                    {days
                      .filter((item) => {
                        const currentValue = Number(row.dia_actividad || 0)
                        const selectedInOtherRow = scheduleRows.some(
                          (otherRow, otherIndex) => otherIndex !== index && Number(otherRow.dia_actividad || 0) === item.id,
                        )
                        return item.id === currentValue || !selectedInOtherRow
                      })
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                  </select>
                  <div className="grid gap-1">
                    <p className={`text-[11px] font-semibold ${textClass}`}>Horario</p>
                    <div className="overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-1">
                        {HOUR_OPTIONS.map((hour) => {
                          const selected = row.horarios_actividad.includes(hour)
                          return (
                            <button
                              key={`${index}-${hour}`}
                              type="button"
                              onClick={() =>
                                updateScheduleRow(index, {
                                  horarios_actividad: selected
                                    ? row.horarios_actividad.filter((value) => value !== hour)
                                    : [...row.horarios_actividad, hour].sort((a, b) => Number(a) - Number(b)),
                                })
                              }
                              className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                selected
                                  ? 'border-[#E7BA61] bg-[#232D4F] text-white'
                                  : isDark
                                    ? 'border-white/30 bg-white/10 text-white'
                                    : 'border-slate-300 bg-white text-slate-700'
                              }`}
                            >
                              {hour}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <p className={`text-[11px] ${detailTextClass}`}>
                      {row.horarios_actividad.length === 0
                        ? 'Selecciona una o mas horas.'
                        : `Horas: ${row.horarios_actividad.join(', ')}`}
                    </p>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeScheduleRow(index)}
                        disabled={scheduleRows.length <= 1}
                        className="rounded-full bg-[#C62828] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addScheduleRow}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-[12px] font-semibold ${
                isDark ? 'border-white/40 text-white' : 'border-[#232D4F] text-[#232D4F]'
              }`}
            >
              + Agregar dia/horario
            </button>
          </div>

          {formError ? <p className="text-xs text-[#C62828]">{formError}</p> : null}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${isDark ? 'border-white/40 text-white' : 'border-slate-300 text-slate-700'}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#232D4F] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
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
                                                  {item.genero || '-'}
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
                                          className={`rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#232D4F] ${isDark ? '' : 'border border-[#232D4F]'}`}
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDelete(activity)}
                                          className="rounded-full bg-[#C62828] px-3 py-1 text-xs font-semibold text-white"
                                        >
                                          Eliminar
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
    </section>
  )
}
