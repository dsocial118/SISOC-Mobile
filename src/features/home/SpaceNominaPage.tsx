import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDay,
  faCheck,
  faChild,
  faChevronDown,
  faChevronUp,
  faClock,
  faMagnifyingGlass,
  faPersonCane,
  faPersonDress,
  faPerson,
  faUser,
  faUserGraduate,
  faUsers,
  faUserTie,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
import { listSpaceActivities, type SpaceActivityItem } from '../../api/activitiesApi'
import {
  createNominaPerson,
  deleteNominaPerson,
  listNominaGenders,
  listSpaceNomina,
  previewNominaDni,
  updateNominaPerson,
  type CreateNominaPayload,
  type NominaGender,
  type NominaPerson,
  type NominaRenaperPreview,
  type NominaStats,
  type NominaTab,
} from '../../api/nominaApi'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

type FormState = {
  nombre: string
  apellido: string
  dni: string
  sexo_id: string
  fecha_nacimiento: string
  es_indocumentado: boolean
  asistencia_alimentaria: boolean
  asistencia_actividades: boolean
  actividad_ids: number[]
}

type GroupedActivityOption = {
  categoria: string
  actividades: Array<{
    nombre: string
    slots: SpaceActivityItem[]
  }>
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

const EMPTY_FORM: FormState = {
  nombre: '',
  apellido: '',
  dni: '',
  sexo_id: '',
  fecha_nacimiento: '',
  es_indocumentado: false,
  asistencia_alimentaria: true,
  asistencia_actividades: false,
  actividad_ids: [],
}

const EMPTY_STATS: NominaStats = {
  total_nomina: 0,
  genero: { M: 0, F: 0, X: 0 },
  menores_edad: 0,
  mayores_edad: 0,
}

function parseApiError(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<Record<string, unknown>>
  if (axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ETIMEDOUT') {
    return 'La validación del DNI está demorando. Intentá nuevamente en unos segundos.'
  }
  const data = axiosError?.response?.data
  if (!data) {
    return fallback
  }
  if (typeof data.detail === 'string') {
    return data.detail
  }
  if (typeof data.detail === 'object' && data.detail !== null) {
    const first = Object.values(data.detail)[0]
    if (Array.isArray(first) && first.length > 0) {
      return String(first[0])
    }
    if (typeof first === 'string') {
      return first
    }
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

function groupLinkedActivities(
  actividades: NominaPerson['actividades'],
): GroupedLinkedActivity[] {
  const categoriaMap = new Map<
    string,
    Map<string, Map<string, Set<string>>>
  >()

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
              horarios: Array.from(horariosSet.values()).sort((a, b) =>
                a.localeCompare(b),
              ),
            })),
        })),
    }))
}

export function SpaceNominaPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [tab, setTab] = useState<NominaTab>('consolidada')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<NominaStats>(EMPTY_STATS)
  const [rows, setRows] = useState<NominaPerson[]>([])
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({})
  const [genders, setGenders] = useState<NominaGender[]>([])
  const [activities, setActivities] = useState<SpaceActivityItem[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editingNominaId, setEditingNominaId] = useState<number | null>(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewingRenaper, setPreviewingRenaper] = useState(false)
  const [renaperPreview, setRenaperPreview] = useState<NominaRenaperPreview | null>(null)
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<Record<string, boolean>>({})
  const [expandedActivityKeys, setExpandedActivityKeys] = useState<Record<string, boolean>>({})
  const isEditing = Boolean(editingNominaId)

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
  const infoLabelClass = isDark
    ? 'text-[10px] font-normal text-white/75'
    : 'text-[10px] font-normal text-[#232D4F]'
  const infoValueClass = isDark
    ? 'text-[14px] font-medium text-white'
    : 'text-[14px] font-medium text-[#232D4F]'
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

  const groupedActivityOptions = useMemo<GroupedActivityOption[]>(() => {
    const map = new Map<number, SpaceActivityItem>()
    for (const activity of activities) {
      if (!map.has(activity.id)) {
        map.set(activity.id, activity)
      }
    }
    const ordered = Array.from(map.values()).sort((a, b) => {
      const byCategory = a.categoria.localeCompare(b.categoria)
      if (byCategory !== 0) {
        return byCategory
      }
      const byActivity = a.actividad.localeCompare(b.actividad)
      if (byActivity !== 0) {
        return byActivity
      }
      const byDay = a.dia_actividad_nombre.localeCompare(b.dia_actividad_nombre)
      if (byDay !== 0) {
        return byDay
      }
      return a.horario_actividad.localeCompare(b.horario_actividad)
    })

    const categoryMap = new Map<string, Map<string, SpaceActivityItem[]>>()
    for (const item of ordered) {
      if (!categoryMap.has(item.categoria)) {
        categoryMap.set(item.categoria, new Map<string, SpaceActivityItem[]>())
      }
      const activityMap = categoryMap.get(item.categoria)!
      if (!activityMap.has(item.actividad)) {
        activityMap.set(item.actividad, [])
      }
      activityMap.get(item.actividad)!.push(item)
    }

    return Array.from(categoryMap.entries()).map(([categoria, activityMap]) => ({
      categoria,
      actividades: Array.from(activityMap.entries()).map(([nombre, slots]) => ({
        nombre,
        slots,
      })),
    }))
  }, [activities])

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

  async function loadNomina(currentTab: NominaTab, currentQ: string) {
    if (!spaceId) {
      return
    }
    const response = await listSpaceNomina(spaceId, {
      tab: currentTab,
      q: currentQ.trim() || undefined,
    })
    setStats(response.stats)
    setRows(response.results)
  }

  useEffect(() => {
    let isMounted = true
    async function bootstrap() {
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
        const [gendersResult, activitiesResult] = await Promise.allSettled([
          listNominaGenders(spaceId),
          listSpaceActivities(spaceId),
        ])
        if (!isMounted) {
          return
        }
        if (gendersResult.status === 'fulfilled') {
          setGenders(gendersResult.value)
        }
        if (activitiesResult.status === 'fulfilled') {
          setActivities(activitiesResult.value)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar la nómina.'))
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
  }, [searchQuery, setPageLoading, spaceId, tab])

  function applySearch() {
    setSearchQuery(searchInput)
  }

  function resetForm() {
    setFormData(EMPTY_FORM)
    setEditingNominaId(null)
    setFormError('')
    setRenaperPreview(null)
    setPreviewingRenaper(false)
    setFormOpen(false)
  }

  function openCreateWithActivity() {
    setEditingNominaId(null)
    setFormData((current) => ({
      ...EMPTY_FORM,
      es_indocumentado: current.es_indocumentado,
      asistencia_alimentaria: false,
      asistencia_actividades: true,
    }))
    setFormError('')
    setFormOpen(true)
  }

  function toggleActivitySlot(slotId: number) {
    setFormData((current) => {
      const selected = current.actividad_ids.includes(slotId)
      return {
        ...current,
        actividad_ids: selected
          ? current.actividad_ids.filter((item) => item !== slotId)
          : [...current.actividad_ids, slotId],
      }
    })
  }

  function toggleActivityGroup(slotIds: number[]) {
    setFormData((current) => {
      const allSelected = slotIds.every((id) => current.actividad_ids.includes(id))
      return {
        ...current,
        actividad_ids: allSelected
          ? current.actividad_ids.filter((id) => !slotIds.includes(id))
          : Array.from(new Set([...current.actividad_ids, ...slotIds])),
      }
    })
  }

  function toggleCategory(categoryKey: string) {
    setExpandedCategoryKeys((current) => ({
      ...current,
      [categoryKey]: !current[categoryKey],
    }))
  }

  function toggleActivity(activityKey: string) {
    setExpandedActivityKeys((current) => ({
      ...current,
      [activityKey]: !current[activityKey],
    }))
  }

  function openEditForm(row: NominaPerson) {
    const genderId = genders.find((item) => item.sexo.toLowerCase() === (row.genero || '').toLowerCase())?.id
    setExpandedIds({})
    setRenaperPreview(null)
    setEditingNominaId(row.id)
    setFormData({
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      dni: row.dni || '',
      sexo_id: genderId ? String(genderId) : '',
      fecha_nacimiento: row.fecha_nacimiento || '',
      es_indocumentado: row.es_indocumentado,
      asistencia_alimentaria: row.badges.includes('Alimentación'),
      asistencia_actividades: row.badges.includes('Actividades'),
      actividad_ids: row.actividades.map((item) => item.actividad_id),
    })
    setFormError('')
    setFormOpen(true)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!spaceId) {
      return
    }
    const normalizedDni = formData.dni.replace(/\D/g, '')

    if (!editingNominaId && !formData.es_indocumentado && !renaperPreview) {
      if (!/^\d{7,8}$/.test(normalizedDni)) {
        setFormError('Formato de DNI inválido. Debe contener 7 u 8 dígitos.')
        return
      }
      setPreviewingRenaper(true)
      setFormError('')
      try {
        const preview = await previewNominaDni(spaceId, normalizedDni)
        setRenaperPreview(preview)
      } catch (error) {
        setFormError(parseApiError(error, 'No se pudieron obtener datos desde RENAPER.'))
      } finally {
        setPreviewingRenaper(false)
      }
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload: CreateNominaPayload = {
        asistencia_alimentaria: formData.asistencia_alimentaria,
        asistencia_actividades: formData.asistencia_actividades,
        actividad_ids: formData.actividad_ids,
        es_indocumentado: formData.es_indocumentado,
      }
      if (formData.es_indocumentado) {
        payload.nombre = formData.nombre.trim()
        payload.apellido = formData.apellido.trim()
        payload.sexo_id = Number(formData.sexo_id)
        payload.fecha_nacimiento = formData.fecha_nacimiento
      } else {
        payload.dni = normalizedDni
      }
      if (editingNominaId) {
        await updateNominaPerson(spaceId, editingNominaId, payload)
      } else {
        await createNominaPerson(spaceId, payload)
      }
      await loadNomina(tab, searchQuery)
      resetForm()
    } catch (error) {
      setFormError(parseApiError(error, 'No se pudo guardar la persona en nómina.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(nominaId: number) {
    if (!spaceId) {
      return
    }
    const confirmed = window.confirm('¿Dar de baja esta persona de la nómina?')
    if (!confirmed) {
      return
    }
    try {
      await deleteNominaPerson(spaceId, nominaId)
      await loadNomina(tab, searchQuery)
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo dar de baja la persona.'))
    }
  }

  function toggleExpanded(nominaId: number) {
    setExpandedIds((current) => ({
      ...current,
      [nominaId]: !current[nominaId],
    }))
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
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Nómina Consolidada</h2>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-full bg-[#2E7D33] px-3 py-1 text-xs font-semibold text-white"
        >
          + Agregar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['consolidada', 'Consolidada'],
          ['alimentaria', 'Alimentaria'],
          ['formacion', 'Actividades de Formación'],
        ] as Array<[NominaTab, string]>).map(([key, label]) => (
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
            {label}
          </button>
        ))}
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
            placeholder="Buscar por DNI, apellido, nombre o género"
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
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[#F4D28A] bg-gradient-to-br from-[#7C2D12] via-[#B45309] to-[#F59E0B] p-3 text-center shadow-[0_8px_18px_rgba(120,69,18,0.28)]">
          <p className="text-[16px] font-bold text-white">Asistentes</p>
          <div className="mt-2 py-2">
            <p className="text-[20px] font-extrabold leading-none text-white">{stats.total_nomina}</p>
            <div className="mt-1 flex justify-center">
              <FontAwesomeIcon
                icon={faUsers}
                aria-hidden="true"
                className="text-white"
                style={{ fontSize: 24 }}
              />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#8BE0C8] bg-gradient-to-br from-[#0F766E] via-[#0EA5A4] to-[#22C55E] p-3 text-center shadow-[0_8px_18px_rgba(10,92,84,0.28)]">
          <p className="text-[16px] font-bold text-white">Género</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="px-2 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{stats.genero.M}</p>
              <FontAwesomeIcon icon={faPerson} aria-hidden="true" className="mt-1 text-white" style={{ fontSize: 24 }} />
            </div>
            <div className="px-2 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{stats.genero.F}</p>
              <FontAwesomeIcon icon={faPersonDress} aria-hidden="true" className="mt-1 text-white" style={{ fontSize: 24 }} />
            </div>
            <div className="px-2 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{stats.genero.X}</p>
              <p className="mt-1 text-[24px] font-black leading-none text-white">X</p>
            </div>
          </div>
        </div>
        <div className="col-span-2 rounded-2xl border border-[#CFA9FF] bg-gradient-to-br from-[#7B63D9] via-[#9C7CF0] to-[#C3A7FF] p-3 text-center shadow-[0_8px_18px_rgba(92,67,175,0.28)]">
          <p className="text-[16px] font-bold text-white">Edades</p>
          <div className="mt-2 grid grid-cols-5 gap-1">
            <div className="px-1 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{ageGroups.ninos}</p>
              <FontAwesomeIcon icon={faChild} aria-hidden="true" className="mt-1 text-white" style={{ fontSize: 24 }} />
              <p className="mt-1 text-[10px] font-medium text-white/90">0-13</p>
            </div>
            <div className="px-1 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{ageGroups.adolescentes}</p>
              <FontAwesomeIcon icon={faUserGraduate} aria-hidden="true" className="mt-1 text-white" style={{ fontSize: 24 }} />
              <p className="mt-1 text-[10px] font-medium text-white/90">14-17</p>
            </div>
            <div className="px-1 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{ageGroups.adultos}</p>
              <FontAwesomeIcon icon={faUser} aria-hidden="true" className="mt-1 text-white" style={{ fontSize: 24 }} />
              <p className="mt-1 text-[10px] font-medium text-white/90">18-49</p>
            </div>
            <div className="px-1 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{ageGroups.adultosMayores}</p>
              <FontAwesomeIcon icon={faUserTie} aria-hidden="true" className="mt-1 text-white" style={{ fontSize: 24 }} />
              <p className="mt-1 text-[10px] font-medium text-white/90">50-65</p>
            </div>
            <div className="px-1 py-2 text-center">
              <p className="text-[20px] font-extrabold leading-none text-white">{ageGroups.mayoresAvanzados}</p>
              <FontAwesomeIcon icon={faPersonCane} aria-hidden="true" className="mt-1 text-white" style={{ fontSize: 24 }} />
              <p className="mt-1 text-[10px] font-medium text-white/90">66+</p>
            </div>
          </div>
        </div>
      </div>

      {formOpen ? (
        <form
          onSubmit={(event) => void handleCreate(event)}
          className={`grid gap-2 rounded-xl border p-3 ${subCardClass}`}
          style={cardStyle}
        >
          {!editingNominaId ? (
            <p className={`text-sm font-semibold ${textClass}`}>Alta de persona</p>
          ) : null}
          {!isEditing ? (
            <label className={`flex items-center gap-2 text-xs ${detailTextClass}`}>
              <input
                type="checkbox"
                checked={formData.es_indocumentado}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    es_indocumentado: event.target.checked,
                    dni: event.target.checked ? '' : current.dni,
                  }))
                }
              />
              Indocumentado
            </label>
          ) : null}

          {isEditing ? (
            <div className={`text-[12px] ${detailTextClass}`}>
              <p className={`text-[14px] font-bold ${textClass}`}>
                {formData.apellido || '-'}, {formData.nombre || '-'}
              </p>
              <div className="mt-2 grid grid-cols-3 items-start gap-3">
                <div className="min-w-0">
                  <p className={infoLabelClass}>DNI</p>
                  <p className={infoValueClass}>
                    {formData.es_indocumentado ? 'Sin documento' : formData.dni || 'Sin documento'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className={infoLabelClass}>Fecha nacimiento</p>
                  <p className={infoValueClass}>{formatLatinDate(formData.fecha_nacimiento)}</p>
                </div>
                <div className="min-w-0">
                  <p className={infoLabelClass}>Género</p>
                  <p className={infoValueClass}>
                    {genders.find((item) => String(item.id) === formData.sexo_id)?.sexo || '-'}
                  </p>
                </div>
              </div>
              {formData.es_indocumentado ? (
                <p className="mt-1 text-[#E7BA61]">Indocumentado</p>
              ) : null}
            </div>
          ) : null}

          {formData.es_indocumentado ? (
            <div className="grid gap-2">
              <input
                placeholder="Nombre"
                value={formData.nombre}
                onChange={(event) => setFormData((current) => ({ ...current, nombre: event.target.value }))}
                className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              />
              <input
                placeholder="Apellido"
                value={formData.apellido}
                onChange={(event) => setFormData((current) => ({ ...current, apellido: event.target.value }))}
                className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              />
              <div className={`grid gap-1 rounded-lg border px-3 py-2 ${isDark ? 'border-white/30 bg-white/10' : 'border-slate-300 bg-white'}`}>
                <p className={`text-[12px] font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>Género</p>
                <div
                  className={`grid gap-1 rounded-xl p-1 ${
                    isDark ? 'bg-[#1A223E]/80' : 'bg-slate-100'
                  }`}
                  style={{ gridTemplateColumns: `repeat(${Math.max(genders.length, 1)}, minmax(0, 1fr))` }}
                >
                  {genders.map((gender) => {
                    const selected = formData.sexo_id === String(gender.id)
                    return (
                      <button
                        type="button"
                        key={gender.id}
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            sexo_id: selected ? '' : String(gender.id),
                          }))
                        }
                        className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[13px] font-semibold transition-all ${
                          selected
                            ? 'border-[#E7BA61] bg-[#E7BA61] text-[#232D4F] shadow-[0_1px_3px_rgba(0,0,0,0.22)]'
                            : isDark
                              ? 'border-white/20 bg-transparent text-white/90'
                              : 'border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <span>{gender.sexo}</span>
                        {selected ? (
                          <FontAwesomeIcon icon={faCheck} aria-hidden="true" style={{ fontSize: 11 }} />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid gap-1">
                <label className={`text-[12px] font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                  Fecha de nacimiento
                </label>
                <input
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, fecha_nacimiento: event.target.value }))
                  }
                  className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                />
              </div>
            </div>
          ) : (
            <>
              {isEditing ? null : (
                <input
                  placeholder="DNI"
                  value={formData.dni}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    setFormData((current) => ({ ...current, dni: nextValue }))
                    if (renaperPreview) {
                      setRenaperPreview(null)
                    }
                  }}
                  className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                />
              )}
            </>
          )}

          {!isEditing && !formData.es_indocumentado && renaperPreview ? (
            <div className={`grid gap-2 rounded-lg border p-3 ${subCardClass}`}>
              <p className={`text-[12px] font-semibold ${textClass}`}>Datos RENAPER</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className={infoLabelClass}>Nombre</p>
                  <p className={infoValueClass}>{renaperPreview.nombre || '-'}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>Apellido</p>
                  <p className={infoValueClass}>{renaperPreview.apellido || '-'}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>Documento</p>
                  <p className={infoValueClass}>{renaperPreview.documento || '-'}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>Fecha de nacimiento</p>
                  <p className={infoValueClass}>
                    {formatLatinDate(renaperPreview.fecha_nacimiento)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className={infoLabelClass}>Sexo</p>
                  <p className={infoValueClass}>{renaperPreview.sexo || '-'}</p>
                </div>
              </div>
            </div>
          ) : null}

          <label className={`flex items-center gap-2 text-xs ${detailTextClass}`}>
            <input
              type="checkbox"
              checked={formData.asistencia_alimentaria}
              onChange={(event) =>
                setFormData((current) => ({ ...current, asistencia_alimentaria: event.target.checked }))
              }
            />
            Prestación Alimentaria
          </label>
          <label className={`flex items-center gap-2 text-xs ${detailTextClass}`}>
            <input
              type="checkbox"
              checked={formData.asistencia_actividades}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  asistencia_actividades: event.target.checked,
                  actividad_ids: event.target.checked ? current.actividad_ids : [],
                }))
              }
            />
            Actividades de Formación
          </label>

          {formData.asistencia_actividades ? (
            <div className={`grid gap-2 rounded-lg border p-2 ${subCardClass}`}>
              {groupedActivityOptions.length === 0 ? (
                <p className={`text-[12px] ${detailTextClass}`}>No hay actividades cargadas en el espacio.</p>
              ) : (
                groupedActivityOptions.map((category) => (
                  <div key={category.categoria} className={`rounded-lg border p-2 ${subCardClass}`}>
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.categoria)}
                      className={`flex w-full items-center justify-between text-left text-[12px] font-semibold ${textClass}`}
                    >
                      <span>{category.categoria}</span>
                      <FontAwesomeIcon
                        icon={expandedCategoryKeys[category.categoria] ? faChevronUp : faChevronDown}
                        aria-hidden="true"
                        style={{ fontSize: 12 }}
                      />
                    </button>
                    {expandedCategoryKeys[category.categoria] ? (
                      <div className="mt-1 grid gap-2">
                        {category.actividades.map((activityGroup) => {
                          const activityKey = `${category.categoria}-${activityGroup.nombre}`
                          const slotIds = activityGroup.slots.map((slot) => slot.id)
                          const selectedCount = slotIds.filter((id) => formData.actividad_ids.includes(id)).length
                          const allSelected = selectedCount > 0 && selectedCount === slotIds.length
                          return (
                            <div key={activityKey} className={`rounded-lg border p-2 ${subCardClass}`}>
                              <div className="flex items-center justify-between gap-2">
                                <label className={`flex min-w-0 items-center gap-2 text-[12px] ${textClass}`}>
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => toggleActivityGroup(slotIds)}
                                  />
                                  <span className="truncate font-semibold">{activityGroup.nombre}</span>
                                  <span className={`text-[11px] ${detailTextClass}`}>
                                    ({selectedCount}/{slotIds.length})
                                  </span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => toggleActivity(activityKey)}
                                  className={`h-6 w-6 rounded-full border ${isDark ? 'border-white/30 text-white' : 'border-slate-300 text-slate-700'}`}
                                  aria-label={
                                    expandedActivityKeys[activityKey]
                                      ? 'Ocultar horarios'
                                      : 'Ver horarios'
                                  }
                                >
                                  <FontAwesomeIcon
                                    icon={
                                      expandedActivityKeys[activityKey]
                                        ? faChevronUp
                                        : faChevronDown
                                    }
                                    aria-hidden="true"
                                    style={{ fontSize: 11 }}
                                  />
                                </button>
                              </div>
                              {expandedActivityKeys[activityKey] ? (
                                <div className="mt-2 grid gap-1 pl-5">
                                  {activityGroup.slots.map((slot) => {
                                    const checked = formData.actividad_ids.includes(slot.id)
                                    return (
                                      <label
                                        key={slot.id}
                                        className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleActivitySlot(slot.id)}
                                        />
                                        <span>
                                          {slot.dia_actividad_nombre} - {slot.horario_actividad}
                                        </span>
                                      </label>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          ) : null}

          {formError ? <p className="text-xs text-[#C62828]">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full bg-[#C62828] px-3 py-1 text-xs font-semibold text-white"
            >
              Cancelar
            </button>
            {!isEditing && !formData.es_indocumentado && renaperPreview ? (
              <button
                type="button"
                onClick={() => setRenaperPreview(null)}
                className={`rounded-full border bg-white px-3 py-1 text-xs font-semibold ${
                  isDark ? 'border-white/40 text-[#232D4F]' : 'border-slate-300 text-[#232D4F]'
                }`}
              >
                Cancelar validación
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving || previewingRenaper}
              className="rounded-full bg-[#232D4F] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              {previewingRenaper
                ? 'Consultando RENAPER...'
                : saving
                  ? 'Guardando...'
                  : !isEditing && !formData.es_indocumentado && !renaperPreview
                    ? 'Validar DNI'
                    : editingNominaId
                      ? 'Guardar cambios'
                      : 'Guardar'}
            </button>
          </div>
        </form>
      ) : null}

      {!isEditing && rows.length === 0 ? (
        <div className="grid gap-2">
          <p className={`text-sm ${detailTextClass}`}>
            {tab === 'formacion'
              ? 'No hay personas vinculadas a Actividades de Formación en este espacio.'
              : tab === 'alimentaria'
                ? 'No hay personas vinculadas a Prestación Alimentaria en este espacio.'
                : 'No hay personas para el filtro seleccionado.'}
          </p>
          {tab === 'formacion' ? (
            <button
              type="button"
              onClick={openCreateWithActivity}
              className="w-fit rounded-full bg-[#2E7D33] px-3 py-1 text-xs font-semibold text-white"
            >
              + Agregar persona con actividad
            </button>
          ) : null}
        </div>
      ) : !isEditing ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <article key={row.id} className={`rounded-xl border p-3 ${subCardClass}`} style={cardStyle}>
              <div className={`text-[12px] ${detailTextClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[14px] font-bold ${textClass}`}>
                    {row.apellido}, {row.nombre}
                  </p>
                  <div className="flex items-center gap-2">
                    {row.badges.includes('Alimentación') ? (
                      <span className={`${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
                        <FontAwesomeIcon icon={faUtensils} aria-hidden="true" style={{ fontSize: 14 }} />
                      </span>
                    ) : null}
                    {row.badges.includes('Actividades') ? (
                      <span className={`inline-flex items-center gap-1 ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
                        <FontAwesomeIcon icon={faUsers} aria-hidden="true" style={{ fontSize: 14 }} />
                        <span className="text-[12px] font-semibold leading-none">
                          {new Set(row.actividades.map((item) => item.actividad)).size}
                        </span>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.id)}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border ${isDark ? 'border-white/40 text-white' : 'border-slate-300 text-slate-700'}`}
                      aria-label={expandedIds[row.id] ? 'Ocultar actividades' : 'Ver actividades'}
                    >
                      <FontAwesomeIcon
                        icon={expandedIds[row.id] ? faChevronUp : faChevronDown}
                        aria-hidden="true"
                        style={{ fontSize: 12 }}
                      />
                    </button>
                  </div>
                </div>
                <div>
                  <div className="mt-2 grid grid-cols-3 items-start gap-3">
                    <div className="min-w-0">
                      <p className={infoLabelClass}>DNI</p>
                      <p className={infoValueClass}>{row.dni || 'Sin documento'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className={infoLabelClass}>Fecha nacimiento</p>
                      <p className={infoValueClass}>{formatLatinDate(row.fecha_nacimiento)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className={infoLabelClass}>Género</p>
                      <p className={infoValueClass}>{row.genero || '-'}</p>
                    </div>
                  </div>
                  {row.es_indocumentado ? (
                    <p className="mt-1 text-[#E7BA61]">Indocumentado</p>
                  ) : null}
                </div>
              </div>
              <div
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  expandedIds[row.id] ? 'mt-2 max-h-[420px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className={`grid gap-1 rounded-lg border p-2 ${subCardClass}`}>
                  <p className={`text-[12px] font-semibold ${textClass}`}>Actividades vinculadas</p>
                  {row.actividades.length === 0 ? (
                    <p className={`text-[12px] ${detailTextClass}`}>Sin actividades vinculadas.</p>
                  ) : (
                    groupLinkedActivities(row.actividades).map((categoriaGroup) => (
                      <div
                        key={`${row.id}-${categoriaGroup.categoria}`}
                        className={`mt-1 rounded-lg border p-2 ${isDark ? 'border-white/20 bg-white/10' : 'border-slate-300 bg-white/80'}`}
                      >
                        <p className={`text-[12px] font-semibold ${textClass}`}>{categoriaGroup.categoria}</p>
                        {categoriaGroup.actividades.map((actividadGroup) => (
                          <div
                            key={`${row.id}-${categoriaGroup.categoria}-${actividadGroup.nombre}`}
                            className={`mt-2 grid gap-1 rounded-md border p-2 pl-3 ${isDark ? 'border-white/10 bg-[#1E2A47]/70' : 'border-slate-200 bg-slate-50/90'}`}
                          >
                            <p className={`flex items-center gap-2 text-[12px] font-semibold ${detailTextClass}`}>
                              <FontAwesomeIcon icon={faUsers} aria-hidden="true" style={{ fontSize: 11 }} />
                              {actividadGroup.nombre}
                            </p>
                            {actividadGroup.dias.map((diaGroup) => (
                              <div
                                key={`${row.id}-${categoriaGroup.categoria}-${actividadGroup.nombre}-${diaGroup.nombre}`}
                                className={`mt-1 rounded-md px-2 py-1 ${isDark ? 'bg-white/10' : 'bg-white'}`}
                              >
                                <p className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}>
                                  <FontAwesomeIcon icon={faCalendarDay} aria-hidden="true" style={{ fontSize: 11 }} />
                                  <span className="font-medium">{diaGroup.nombre}</span>
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1 pl-5">
                                  {diaGroup.horarios.map((horario) => (
                                    <span
                                      key={`${row.id}-${categoriaGroup.categoria}-${actividadGroup.nombre}-${diaGroup.nombre}-${horario}`}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11px] ${isDark ? 'border-white/25 text-white/90' : 'border-slate-300 text-slate-700'}`}
                                    >
                                      <FontAwesomeIcon icon={faClock} aria-hidden="true" style={{ fontSize: 10 }} />
                                      {horario}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(row)}
                      className={`rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#232D4F] ${isDark ? '' : 'border border-[#232D4F]'}`}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row.id)}
                      className="rounded-full bg-[#C62828] px-3 py-1 text-xs font-semibold text-white"
                    >
                      Baja
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}



