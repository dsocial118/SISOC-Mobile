import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import {
  listCollaboratorActivities,
  listCollaboratorGenders,
  previewSpaceCollaboratorDni,
  type CollaboratorGenderOption,
  type CollaboratorPreview,
  type SpaceCollaboratorActivity,
  type SpaceCollaboratorPayload,
} from '../../api/collaboratorsApi'
import { parseApiError as parseCommonApiError } from '../../api/errorUtils'
import type { SpaceCollaboratorRecord } from '../../db/database'
import {
  createCollaboratorOffline,
  deleteCollaboratorOffline,
  listLocalSpaceCollaborators,
  mergeRemoteCollaborators,
  updateCollaboratorOffline,
} from './collaboratorsOffline'
import { syncNow } from '../../sync/engine'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'

type FormState = {
  dni: string
  genero: string
  codigo_telefono: string
  numero_telefono: string
  fecha_alta: string
  fecha_baja: string
  actividad_ids: number[]
}

const DNI_REGEX = /^\d{7,8}$/

const EMPTY_FORM: FormState = {
  dni: '',
  genero: 'ND',
  codigo_telefono: '',
  numero_telefono: '',
  fecha_alta: new Date().toISOString().slice(0, 10),
  fecha_baja: '',
  actividad_ids: [],
}

function parseApiError(error: unknown, fallback: string, timeoutMessage?: string): string {
  const axiosError = error as AxiosError<Record<string, unknown>>
  if (axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ETIMEDOUT') {
    return timeoutMessage || fallback
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

export function CollaboratorsCard({
  spaceId,
  isDark,
  cardStyle,
  textClass,
  detailTextClass,
  subCardClass,
}: {
  spaceId: string
  isDark: boolean
  cardStyle: Record<string, string>
  textClass: string
  detailTextClass: string
  subCardClass: string
}) {
  const [refreshError, setRefreshError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<CollaboratorPreview | null>(null)
  const [genderOptions, setGenderOptions] = useState<CollaboratorGenderOption[]>([])
  const [activityOptions, setActivityOptions] = useState<SpaceCollaboratorActivity[]>([])
  const [collaborators, setCollaborators] = useState<SpaceCollaboratorRecord[] | undefined>(undefined)
  const [collaboratorPendingDelete, setCollaboratorPendingDelete] =
    useState<SpaceCollaboratorRecord | null>(null)
  const [deletingCollaboratorId, setDeletingCollaboratorId] = useState<string | null>(null)

  const isEditing = Boolean(editingId)
  const submitLabel = isEditing ? 'Guardar cambios' : !preview ? 'Validar DNI' : 'Guardar colaborador'
  const panelTitle = isEditing ? 'Editar colaborador' : 'Alta de colaborador'
  const infoLabelClass = isDark ? 'text-[10px] font-normal text-white/75' : 'text-[10px] font-normal text-[#232D4F]'
  const infoValueClass = isDark ? 'text-[14px] font-medium text-white' : 'text-[14px] font-medium text-[#232D4F]'
  const inputBaseClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-white/30 bg-white/10 text-white placeholder:text-white/60' : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400'}`

  async function refreshLocalRows() {
    const rows = await listLocalSpaceCollaborators(spaceId)
    setCollaborators(rows)
  }

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      setRefreshError('')
      try {
        await mergeRemoteCollaborators(spaceId)
        const [rows, genders, activities] = await Promise.all([
          listLocalSpaceCollaborators(spaceId),
          listCollaboratorGenders(spaceId),
          listCollaboratorActivities(spaceId),
        ])
        if (!isMounted) {
          return
        }
        setCollaborators(rows)
        setGenderOptions(genders)
        setActivityOptions(activities)
      } catch (error) {
        if (!isMounted) {
          return
        }
        const statusCode = (error as AxiosError)?.response?.status
        if (statusCode === 403 || statusCode === 404) {
          setCollaborators([])
          setRefreshError('')
          return
        }
        setCollaborators([])
        setRefreshError(
          parseApiError(
            error,
            'No se pudieron actualizar colaboradores desde la web.',
            'La carga de colaboradores está demorando. Intentá nuevamente en unos segundos.',
          ),
        )
      }
    }

    void bootstrap()
    return () => {
      isMounted = false
    }
  }, [spaceId])

  function resetForm() {
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setFormError('')
    setPreview(null)
    setPreviewing(false)
    setFormOpen(false)
  }

  function openCreateForm() {
    setExpandedIds({})
    setEditingId(null)
    setFormData({
      ...EMPTY_FORM,
      fecha_alta: new Date().toISOString().slice(0, 10),
    })
    setFormError('')
    setPreview(null)
    setFormOpen(true)
  }

  function openEditForm(item: SpaceCollaboratorRecord) {
    setEditingId(item.id)
    setFormData({
      dni: item.dni,
      genero: item.genero || 'ND',
      codigo_telefono: item.codigo_telefono || '',
      numero_telefono: item.numero_telefono || '',
      fecha_alta: item.fecha_alta || new Date().toISOString().slice(0, 10),
      fecha_baja: item.fecha_baja || '',
      actividad_ids: item.actividades.map((actividad) => actividad.id),
    })
    setPreview({
      source: item.ciudadano_id ? 'sisoc' : 'renaper',
      ciudadano_id: item.ciudadano_id || null,
      ya_registrado_en_espacio: false,
      colaborador_activo_id: item.remote_id || null,
      apellido: item.apellido,
      nombre: item.nombre,
      dni: item.dni,
      prefijo_cuil: item.prefijo_cuil || null,
      cuil_cuit: item.cuil_cuit || null,
      sufijo_cuil: item.sufijo_cuil || null,
      sexo: item.sexo || null,
      fecha_nacimiento: item.fecha_nacimiento || null,
      edad: item.edad ?? null,
    })
    setFormError('')
    setFormOpen(true)
  }

  function toggleExpanded(collaboratorId: string) {
    setExpandedIds((current) => ({
      ...current,
      [collaboratorId]: !current[collaboratorId],
    }))
  }

  function validateForm(data: FormState): string {
    if (!isEditing && !preview) {
      if (!DNI_REGEX.test(data.dni.trim())) {
        return 'El DNI debe tener 7 u 8 dígitos.'
      }
      return ''
    }
    if (!data.fecha_alta) {
      return 'La fecha de alta es obligatoria.'
    }
    if (data.codigo_telefono.trim() && !/^\d+$/.test(data.codigo_telefono.trim())) {
      return 'El código de teléfono debe contener solo números.'
    }
    if (data.numero_telefono.trim() && !/^\d+$/.test(data.numero_telefono.trim())) {
      return 'El número de teléfono debe contener solo números.'
    }
    if (data.actividad_ids.length === 0) {
      return 'Debe seleccionar al menos una actividad.'
    }
    if (data.fecha_baja && data.fecha_baja < data.fecha_alta) {
      return 'La fecha de baja no puede ser anterior a la fecha de alta.'
    }
    return ''
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized: FormState = {
      dni: formData.dni.replace(/\D/g, ''),
      genero: formData.genero,
      codigo_telefono: formData.codigo_telefono.trim(),
      numero_telefono: formData.numero_telefono.trim(),
      fecha_alta: formData.fecha_alta,
      fecha_baja: formData.fecha_baja,
      actividad_ids: formData.actividad_ids,
    }

    const validationError = validateForm(normalized)
    if (validationError) {
      setFormError(validationError)
      return
    }

    if (!isEditing && !preview) {
      setPreviewing(true)
      setFormError('')
      try {
        const previewResponse = await previewSpaceCollaboratorDni(spaceId, normalized.dni)
        if (previewResponse.ya_registrado_en_espacio) {
          setFormError('La persona ya se encuentra registrada como colaborador de este espacio.')
          return
        }
        setPreview(previewResponse)
      } catch (error) {
        setFormError(
          parseCommonApiError(error, 'No se pudieron obtener datos desde SISOC/RENAPER.', {
            timeoutMessage: 'La consulta a RENAPER está demorando. Intentá nuevamente en unos segundos.',
          }),
        )
      } finally {
        setPreviewing(false)
      }
      return
    }

    const payload: SpaceCollaboratorPayload = {
      ciudadano_id: preview?.ciudadano_id || undefined,
      dni: !preview?.ciudadano_id ? normalized.dni : undefined,
      genero: normalized.genero,
      codigo_telefono: normalized.codigo_telefono,
      numero_telefono: normalized.numero_telefono,
      fecha_alta: normalized.fecha_alta,
      fecha_baja: normalized.fecha_baja || null,
      actividad_ids: normalized.actividad_ids,
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        const editing = collaborators?.find((row) => row.id === editingId)
        if (!editing) {
          setFormError('No se encontró el colaborador a editar.')
          return
        }
        await updateCollaboratorOffline(editing, payload)
      } else if (preview) {
        await createCollaboratorOffline(spaceId, payload, preview)
      }
      await refreshLocalRows()
      resetForm()
      void syncNow()
    } catch (error) {
      setFormError(
        parseApiError(
          error,
          'No se pudo guardar el colaborador.',
          'La operación está demorando. Intentá nuevamente en unos segundos.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: SpaceCollaboratorRecord) {
    if (deletingCollaboratorId === item.id) {
      return
    }

    setDeletingCollaboratorId(item.id)
    try {
      await deleteCollaboratorOffline(item)
      if (editingId === item.id) {
        resetForm()
      }
      await refreshLocalRows()
      setCollaboratorPendingDelete(null)
      void syncNow()
    } catch (error) {
      setFormError(
        parseApiError(
          error,
          'No se pudo dar de baja el colaborador.',
          'La operación está demorando. Intentá nuevamente en unos segundos.',
        ),
      )
    } finally {
      setDeletingCollaboratorId(null)
    }
  }

  const currentRows = useMemo(() => collaborators ?? [], [collaborators])

  function toggleActivity(activityId: number) {
    setFormData((current) => ({
      ...current,
      actividad_ids: current.actividad_ids.includes(activityId)
        ? current.actividad_ids.filter((item) => item !== activityId)
        : [...current.actividad_ids, activityId],
    }))
  }

  return (
    <article
      className="progressive-card rounded-[15px] border p-5"
      style={{ ...cardStyle, ['--card-delay' as string]: '210ms' }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Colaboradores del espacio</h2>
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
          className={`mt-3 grid gap-3 rounded-xl border p-3 ${subCardClass}`}
        >
          <p className={`text-sm font-semibold ${textClass}`}>{panelTitle}</p>

          {!isEditing ? (
            <input
              className={inputBaseClass}
              placeholder="DNI"
              value={formData.dni}
              onChange={(event) => {
                setFormData((current) => ({ ...current, dni: event.target.value }))
                if (preview) {
                  setPreview(null)
                }
              }}
            />
          ) : null}

          {preview ? (
            <div className={`grid gap-2 rounded-lg border p-3 ${subCardClass}`}>
              <p className={`text-[12px] font-semibold ${textClass}`}>
                Datos {preview.source === 'sisoc' ? 'SISOC' : 'RENAPER'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className={infoLabelClass}>Nombre</p>
                  <p className={infoValueClass}>{preview.nombre || '-'}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>Apellido</p>
                  <p className={infoValueClass}>{preview.apellido || '-'}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>DNI</p>
                  <p className={infoValueClass}>{preview.dni || '-'}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>Sexo</p>
                  <p className={infoValueClass}>{preview.sexo || '-'}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>Fecha nacimiento</p>
                  <p className={infoValueClass}>{formatLatinDate(preview.fecha_nacimiento)}</p>
                </div>
                <div>
                  <p className={infoLabelClass}>Edad</p>
                  <p className={infoValueClass}>{preview.edad ? String(preview.edad) : '-'}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-1">
              <label className={`text-[12px] font-semibold ${textClass}`}>Género</label>
              <select
                value={formData.genero}
                onChange={(event) => setFormData((current) => ({ ...current, genero: event.target.value }))}
                className={inputBaseClass}
              >
                {genderOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className={`text-[12px] font-semibold ${textClass}`}>Fecha de alta</label>
              <input
                type="date"
                value={formData.fecha_alta}
                onChange={(event) => setFormData((current) => ({ ...current, fecha_alta: event.target.value }))}
                className={inputBaseClass}
              />
            </div>
            <div className="grid gap-1">
              <label className={`text-[12px] font-semibold ${textClass}`}>Código teléfono</label>
              <input
                value={formData.codigo_telefono}
                onChange={(event) => setFormData((current) => ({ ...current, codigo_telefono: event.target.value }))}
                className={inputBaseClass}
                placeholder="Ej. 11"
              />
            </div>
            <div className="grid gap-1">
              <label className={`text-[12px] font-semibold ${textClass}`}>Número teléfono</label>
              <input
                value={formData.numero_telefono}
                onChange={(event) => setFormData((current) => ({ ...current, numero_telefono: event.target.value }))}
                className={inputBaseClass}
                placeholder="Ej. 12345678"
              />
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className={`text-[12px] font-semibold ${textClass}`}>Fecha de baja</label>
              <input
                type="date"
                value={formData.fecha_baja}
                onChange={(event) => setFormData((current) => ({ ...current, fecha_baja: event.target.value }))}
                className={inputBaseClass}
              />
            </div>
          </div>

          <div className={`grid gap-2 rounded-lg border p-3 ${subCardClass}`}>
            <p className={`text-[12px] font-semibold ${textClass}`}>Actividades</p>
            {activityOptions.length === 0 ? (
              <p className={`text-[12px] ${detailTextClass}`}>No hay actividades disponibles.</p>
            ) : (
              <div className="grid gap-2">
                {activityOptions.map((activity) => (
                  <label key={activity.id} className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}>
                    <input
                      type="checkbox"
                      checked={formData.actividad_ids.includes(activity.id)}
                      onChange={() => toggleActivity(activity.id)}
                    />
                    <span>{activity.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {formError ? (
            <div className="rounded-lg border border-[#F2B8B5] bg-[#7A1C1C]/50 p-3 text-sm text-white">
              {formError}
            </div>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${isDark ? 'border-white/40 text-white' : 'border-slate-300 text-slate-700'}`}
            >
              Cancelar
            </button>
            {!isEditing && preview ? (
              <button
                type="button"
                onClick={() => setPreview(null)}
                className={`rounded-full border bg-white px-3 py-1 text-xs font-semibold ${isDark ? 'border-white/40 text-[#232D4F]' : 'border-slate-300 text-[#232D4F]'}`}
              >
                Cancelar validación
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saving || previewing}
              className="rounded-full bg-[#232D4F] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              {previewing ? 'Consultando...' : saving ? 'Guardando...' : submitLabel}
            </button>
          </div>
        </form>
      ) : null}

      {refreshError ? (
        <p className={`mt-3 text-sm ${detailTextClass}`}>{refreshError}</p>
      ) : collaborators === undefined ? (
        <p className={`mt-3 text-sm ${detailTextClass}`}>Cargando colaboradores...</p>
      ) : currentRows.length === 0 ? (
        <p className={`mt-3 text-sm ${detailTextClass}`}>No hay colaboradores asociados.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          {currentRows.map((collaborator, index) => (
            <div
              key={collaborator.id}
              className={`progressive-card rounded-xl border p-3 ${subCardClass}`}
              style={{ ['--card-delay' as string]: `${280 + index * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`min-w-0 text-[13px] ${detailTextClass}`}>
                  <p className={`truncate text-[14px] font-semibold ${textClass}`}>
                    {collaborator.apellido}, {collaborator.nombre}
                  </p>
                  <p className="mt-0.5 truncate text-[12px]">
                    {collaborator.activo ? 'Activo' : `Baja: ${formatLatinDate(collaborator.fecha_baja)}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleExpanded(collaborator.id)}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border ${isDark ? 'border-white/40 text-white' : 'border-slate-300 text-slate-700'}`}
                  aria-label={expandedIds[collaborator.id] ? 'Ocultar detalles' : 'Ver detalles'}
                  title={expandedIds[collaborator.id] ? 'Ocultar detalles' : 'Ver detalles'}
                >
                  <FontAwesomeIcon
                    icon={expandedIds[collaborator.id] ? faChevronUp : faChevronDown}
                    aria-hidden="true"
                    style={{ fontSize: 12 }}
                  />
                </button>
              </div>

              <div
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  expandedIds[collaborator.id] ? 'mt-2 max-h-[320px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className={`grid gap-1 text-[13px] ${detailTextClass}`}>
                  <p><span className={`font-semibold ${textClass}`}>DNI:</span> {collaborator.dni}</p>
                  <p><span className={`font-semibold ${textClass}`}>Sexo:</span> {collaborator.sexo || '-'}</p>
                  <p><span className={`font-semibold ${textClass}`}>Género:</span> {genderOptions.find((item) => item.id === collaborator.genero)?.label || collaborator.genero}</p>
                  <p><span className={`font-semibold ${textClass}`}>Fecha alta:</span> {formatLatinDate(collaborator.fecha_alta)}</p>
                  <p><span className={`font-semibold ${textClass}`}>Fecha baja:</span> {formatLatinDate(collaborator.fecha_baja)}</p>
                  <p><span className={`font-semibold ${textClass}`}>Teléfono:</span> {[collaborator.codigo_telefono, collaborator.numero_telefono].filter(Boolean).join(' ') || '-'}</p>
                  <p>
                    <span className={`font-semibold ${textClass}`}>Actividades:</span>{' '}
                    {collaborator.actividades.length > 0
                      ? collaborator.actividades.map((actividad) => actividad.nombre).join(', ')
                      : '-'}
                  </p>
                  {collaborator.last_error ? (
                    <div className="rounded-lg border border-[#F2B8B5] bg-[#7A1C1C]/50 px-3 py-2 text-xs text-white">
                      {collaborator.last_error}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(collaborator)}
                    className={`rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#232D4F] ${
                      isDark ? '' : 'border border-[#232D4F]'
                    }`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollaboratorPendingDelete(collaborator)}
                    disabled={!collaborator.activo || deletingCollaboratorId === collaborator.id}
                    className="rounded-full bg-[#C62828] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {deletingCollaboratorId === collaborator.id
                      ? 'Eliminando...'
                      : collaborator.activo
                        ? 'Eliminar'
                        : 'Dado de baja'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(collaboratorPendingDelete)}
        title="Confirmar baja de colaborador"
        message={
          collaboratorPendingDelete
            ? `Se va a dar de baja a ${collaboratorPendingDelete.nombre} ${collaboratorPendingDelete.apellido} en este espacio.`
            : ''
        }
        confirmLabel="Dar de baja"
        loading={Boolean(
          collaboratorPendingDelete &&
            deletingCollaboratorId === collaboratorPendingDelete.id,
        )}
        onCancel={() => setCollaboratorPendingDelete(null)}
        onConfirm={() =>
          collaboratorPendingDelete ? void handleDelete(collaboratorPendingDelete) : undefined
        }
      />
    </article>
  )
}

