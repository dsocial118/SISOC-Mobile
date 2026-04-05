import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { listSpaceActivities, type SpaceActivityItem } from '../../api/activitiesApi'
import { parseApiError } from '../../api/errorUtils'
import {
  createNominaPerson,
  getNominaPersonDetail,
  listNominaGenders,
  previewNominaDni,
  updateNominaPerson,
  type CreateNominaPayload,
  type NominaGender,
  type NominaRenaperPreview,
} from '../../api/nominaApi'
import { syncNow } from '../../sync/engine'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/theme'

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

export function SpaceNominaPersonFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId, nominaId } = useParams<{ spaceId: string; nominaId?: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (
      location.state as
        | {
            spaceName?: string
            defaultMode?: 'alimentaria' | 'formacion'
          }
        | null
    ) ?? null

  const isEditing = Boolean(nominaId)
  const isActivitiesMode = isEditing && location.pathname.endsWith('/actividades')
  const isPersonEditMode = isEditing && !isActivitiesMode
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewingRenaper, setPreviewingRenaper] = useState(false)
  const [genders, setGenders] = useState<NominaGender[]>([])
  const [activities, setActivities] = useState<SpaceActivityItem[]>([])
  const [renaperPreview, setRenaperPreview] = useState<NominaRenaperPreview | null>(null)
  const [formData, setFormData] = useState<FormState>(() => {
    if (routeState?.defaultMode === 'formacion') {
      return {
        ...EMPTY_FORM,
        asistencia_alimentaria: false,
        asistencia_actividades: true,
      }
    }
    return EMPTY_FORM
  })
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<Record<string, boolean>>({})
  const [expandedActivityKeys, setExpandedActivityKeys] = useState<Record<string, boolean>>({})

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
  const isReadOnlyPersonEdit = isPersonEditMode && !formData.es_indocumentado

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

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      if (!spaceId) {
        setErrorMessage('No se encontro el espacio seleccionado.')
        setLoading(false)
        return
      }

      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        const [gendersResult, activitiesResult, detailResult] = await Promise.all([
          listNominaGenders(spaceId),
          listSpaceActivities(spaceId),
          isEditing && nominaId ? getNominaPersonDetail(spaceId, nominaId) : Promise.resolve(null),
        ])
        if (!isMounted) {
          return
        }
        setGenders(gendersResult)
        setActivities(activitiesResult)
        if (detailResult) {
          setFormData({
            nombre: detailResult.nombre || '',
            apellido: detailResult.apellido || '',
            dni: detailResult.dni || '',
            sexo_id:
              gendersResult.find((item) => item.sexo === detailResult.genero)?.id?.toString() || '',
            fecha_nacimiento: detailResult.fecha_nacimiento || '',
            es_indocumentado: detailResult.es_indocumentado,
            asistencia_alimentaria: detailResult.badges.includes('Alimentación'),
            asistencia_actividades: detailResult.badges.includes('Actividades'),
            actividad_ids: detailResult.actividades.map((item) => item.actividad_id),
          })
          if (isActivitiesMode) {
            setExpandedCategoryKeys(
              Object.fromEntries(
                Array.from(new Set(activitiesResult.map((item) => item.categoria))).map((key) => [key, true]),
              ),
            )
          }
        }
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar el formulario de nómina.'))
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
  }, [isActivitiesMode, isEditing, nominaId, setPageLoading, spaceId])

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!spaceId) {
      return
    }

    const normalizedDni = formData.dni.replace(/\D/g, '')
    if (!isEditing && !formData.es_indocumentado && !renaperPreview) {
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
        setFormError(
          parseApiError(error, 'No se pudieron obtener datos desde RENAPER.', {
            timeoutMessage:
              'La validación del DNI está demorando. Intentá nuevamente en unos segundos.',
          }),
        )
      } finally {
        setPreviewingRenaper(false)
      }
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload: Partial<CreateNominaPayload> = {}

      if (!isEditing) {
        payload.asistencia_alimentaria = formData.asistencia_alimentaria
        payload.asistencia_actividades = formData.asistencia_actividades
        payload.actividad_ids = formData.actividad_ids
        payload.es_indocumentado = formData.es_indocumentado
      }

      if (isActivitiesMode) {
        payload.asistencia_alimentaria = formData.asistencia_alimentaria
        payload.asistencia_actividades = formData.actividad_ids.length > 0
        payload.actividad_ids = formData.actividad_ids
      }

      if (formData.es_indocumentado && (!isActivitiesMode || !isEditing)) {
        payload.nombre = formData.nombre.trim()
        payload.apellido = formData.apellido.trim()
        payload.sexo_id = Number(formData.sexo_id)
        payload.fecha_nacimiento = formData.fecha_nacimiento
      } else if (!isEditing) {
        payload.dni = normalizedDni
      }

      if (isEditing && nominaId) {
        await updateNominaPerson(spaceId, nominaId, payload)
        void syncNow()
        navigate(`/app-org/espacios/${spaceId}/nomina/${nominaId}`, {
          replace: true,
          state: {
            spaceName: routeState?.spaceName,
            personName: `${formData.apellido}, ${formData.nombre}`,
          },
        })
        return
      }

      const created = await createNominaPerson(spaceId, payload as CreateNominaPayload)
      void syncNow()
      navigate(`/app-org/espacios/${spaceId}/nomina/${created.id}`, {
        replace: true,
        state: {
          spaceName: routeState?.spaceName,
          personName: `${created.apellido}, ${created.nombre}`,
        },
      })
    } catch (error) {
      setFormError(parseApiError(error, 'No se pudo guardar la persona en nómina.'))
    } finally {
      setSaving(false)
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
    <section className="grid gap-3 pb-8">
      <div>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>
          {isActivitiesMode ? 'Actividades de la persona' : isEditing ? 'Editar persona' : 'Alta de persona'}
        </h2>
        <p className={`mt-1 text-sm ${detailTextClass}`}>
          {routeState?.spaceName ? `${routeState.spaceName} · ` : ''}
          {isActivitiesMode ? 'Vinculación con actividades' : 'Nómina del espacio'}
        </p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className={`grid gap-3 rounded-xl border p-3 ${subCardClass}`}
        style={cardStyle}
      >
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
          <div className={`rounded-lg border p-3 ${subCardClass}`}>
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
              <p className="mt-2 text-[#E7BA61]">Indocumentado</p>
            ) : null}
          </div>
        ) : null}

        {!isActivitiesMode && formData.es_indocumentado ? (
          <div className="grid gap-2">
            <input
              placeholder="Nombre"
              value={formData.nombre}
              onChange={(event) => setFormData((current) => ({ ...current, nombre: event.target.value }))}
              className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${
                isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            />
            <input
              placeholder="Apellido"
              value={formData.apellido}
              onChange={(event) => setFormData((current) => ({ ...current, apellido: event.target.value }))}
              className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${
                isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            />
            <div
              className={`grid gap-1 rounded-lg border px-3 py-2 ${
                isDark ? 'border-white/30 bg-white/10' : 'border-slate-300 bg-white'
              }`}
            >
              <p className={`text-[12px] font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>Género</p>
              <div
                className={`grid gap-1 rounded-xl p-1 ${isDark ? 'bg-[#1A223E]/80' : 'bg-slate-100'}`}
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
                      {selected ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" style={{ fontSize: 11 }} /> : null}
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
                className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${
                  isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              />
            </div>
          </div>
        ) : !isEditing ? (
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
            className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${
              isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          />
        ) : null}

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
                <p className={infoValueClass}>{formatLatinDate(renaperPreview.fecha_nacimiento)}</p>
              </div>
              <div className="col-span-2">
                <p className={infoLabelClass}>Sexo</p>
                <p className={infoValueClass}>{renaperPreview.sexo || '-'}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!isEditing ? (
          <>
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
          </>
        ) : null}

        {isActivitiesMode || (!isEditing && formData.asistencia_actividades) ? (
          <div className={`grid gap-2 rounded-lg border p-2 ${subCardClass}`}>
            {isActivitiesMode ? (
              <div className={`rounded-lg border p-3 ${subCardClass}`}>
                <p className={`text-[12px] font-semibold ${textClass}`}>Prestaciones actuales</p>
                <div className={`mt-2 flex flex-wrap gap-2 text-[12px] ${detailTextClass}`}>
                  <span>{formData.asistencia_alimentaria ? 'Alimentación activa' : 'Sin alimentación'}</span>
                  <span>{formData.actividad_ids.length} actividades seleccionadas</span>
                </div>
              </div>
            ) : null}
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
                                className={`h-6 w-6 rounded-full border ${
                                  isDark ? 'border-white/30 text-white' : 'border-slate-300 text-slate-700'
                                }`}
                                aria-label={expandedActivityKeys[activityKey] ? 'Ocultar horarios' : 'Ver horarios'}
                              >
                                <FontAwesomeIcon
                                  icon={expandedActivityKeys[activityKey] ? faChevronUp : faChevronDown}
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
                                    <label key={slot.id} className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}>
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

        {isReadOnlyPersonEdit ? (
          <div className={`rounded-lg border p-3 ${subCardClass}`}>
            <p className={`text-[12px] font-semibold ${textClass}`}>Datos personales</p>
            <p className={`mt-2 text-[12px] ${detailTextClass}`}>
              Las personas documentadas no se editan desde Mobile. Para cambiar sus datos, regularizalos en SISOC Web.
            </p>
          </div>
        ) : null}

        {formError ? <p className="text-xs text-[#C62828]">{formError}</p> : null}

        <div className="flex justify-end gap-2">
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
          {isReadOnlyPersonEdit ? (
            <button
              type="button"
              onClick={() => navigate(`/app-org/espacios/${spaceId}/nomina/${nominaId}`)}
              className="rounded-full bg-[#232D4F] px-4 py-2 text-xs font-semibold text-white"
            >
              Volver
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving || previewingRenaper}
              className="rounded-full bg-[#232D4F] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {previewingRenaper
                ? 'Consultando RENAPER...'
                : saving
                  ? 'Guardando...'
                  : !isEditing && !formData.es_indocumentado && !renaperPreview
                    ? 'Validar DNI'
                    : isActivitiesMode
                      ? 'Guardar actividades'
                      : isEditing
                        ? 'Guardar cambios'
                        : 'Guardar'}
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
