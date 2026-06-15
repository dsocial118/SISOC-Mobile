import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { syncNow } from '../../sync/engine'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'
import {
  createCollaboratorOffline,
  deleteCollaboratorOffline,
  listLocalSpaceCollaborators,
  mergeRemoteCollaborators,
  updateCollaboratorOffline,
} from './collaboratorsOffline'

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM: FormState = {
  dni: '',
  genero: 'ND',
  codigo_telefono: '',
  numero_telefono: '',
  fecha_alta: todayIso(),
  fecha_baja: '',
  actividad_ids: [],
}

function formatLatinDate(rawDate: string | null | undefined): string {
  const value = (rawDate || '').trim()
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value || '-'
}

function parseApiError(error: unknown, fallback: string, timeoutMessage?: string): string {
  const axiosError = error as AxiosError<Record<string, unknown>>
  if (axiosError?.code === 'ECONNABORTED' || axiosError?.code === 'ETIMEDOUT') {
    return timeoutMessage || fallback
  }
  return parseCommonApiError(error, fallback, { timeoutMessage })
}

export function SpaceCollaboratorFormPage() {
  const { spaceId, collaboratorId } = useParams<{ spaceId: string; collaboratorId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const isCreateMode = location.pathname.endsWith('/colaboradores/nuevo')
  const isReactivateMode = location.pathname.endsWith('/reactivar')
  const isEditMode = Boolean(collaboratorId) && !isReactivateMode

  const [target, setTarget] = useState<SpaceCollaboratorRecord | null>(null)
  const [genderOptions, setGenderOptions] = useState<CollaboratorGenderOption[]>([])
  const [activityOptions, setActivityOptions] = useState<SpaceCollaboratorActivity[]>([])
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)
  const [preview, setPreview] = useState<CollaboratorPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [formError, setFormError] = useState('')

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/90' : 'text-slate-700'
  const cardClass = isDark ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white'
  const inputBaseClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${
    isDark
      ? 'border-white/30 bg-white/10 text-white placeholder:text-white/60'
      : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400'
  }`
  const selectBaseClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${
    isDark
      ? 'border-white/30 bg-[#1E2846] text-white'
      : 'border-slate-300 bg-white text-slate-700'
  }`
  const selectOptionClass = isDark ? 'bg-[#1E2846] text-white' : 'bg-white text-slate-700'

  const title = isReactivateMode
    ? 'Reactivar colaborador'
    : isEditMode
      ? 'Editar colaborador'
      : 'Alta de colaborador'
  const submitLabel = isCreateMode && !preview ? 'Validar DNI' : title

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!spaceId) {
        setErrorMessage('No se encontro el espacio.')
        setLoading(false)
        return
      }
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        await mergeRemoteCollaborators(spaceId)
        const [localRows, genders, activities] = await Promise.all([
          listLocalSpaceCollaborators(spaceId),
          listCollaboratorGenders(spaceId),
          listCollaboratorActivities(spaceId),
        ])
        if (!isMounted) {
          return
        }
        setGenderOptions(genders)
        setActivityOptions(activities)

        if (!isCreateMode) {
          const selected = localRows.find((item) => item.id === collaboratorId) || null
          setTarget(selected)
          if (!selected) {
            setErrorMessage('No se encontro el colaborador.')
            return
          }
          if (isEditMode && !selected.activo) {
            setErrorMessage('Solo se pueden editar colaboradores activos.')
            return
          }
          if (isReactivateMode && selected.activo) {
            setErrorMessage('El colaborador ya se encuentra activo.')
            return
          }
          setFormData({
            dni: selected.dni,
            genero: selected.genero || 'ND',
            codigo_telefono: selected.codigo_telefono || '',
            numero_telefono: selected.numero_telefono || '',
            fecha_alta: isReactivateMode ? todayIso() : selected.fecha_alta || todayIso(),
            fecha_baja: isReactivateMode ? '' : selected.fecha_baja || '',
            actividad_ids: selected.actividades.map((actividad) => actividad.id),
          })
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            parseApiError(
              error,
              'No se pudieron cargar los datos del colaborador.',
              'La carga está demorando. Probá nuevamente en unos segundos.',
            ),
          )
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadData()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [collaboratorId, isCreateMode, isEditMode, isReactivateMode, setPageLoading, spaceId])

  const selectedActivities = useMemo(
    () =>
      formData.actividad_ids
        .map((id) => activityOptions.find((activity) => activity.id === id) || target?.actividades.find((activity) => activity.id === id))
        .filter((item): item is SpaceCollaboratorActivity => Boolean(item)),
    [activityOptions, formData.actividad_ids, target?.actividades],
  )

  function backToList() {
    navigate(`/app-org/espacios/${spaceId}/informacion`, { state: location.state })
  }

  function toggleActivity(activityId: number) {
    setFormData((current) => ({
      ...current,
      actividad_ids: current.actividad_ids.includes(activityId)
        ? current.actividad_ids.filter((item) => item !== activityId)
        : [...current.actividad_ids, activityId],
    }))
  }

  function validateForm(data: FormState): string {
    if (isCreateMode && !preview) {
      return DNI_REGEX.test(data.dni.trim()) ? '' : 'El DNI debe tener 7 u 8 digitos.'
    }
    if (!data.fecha_alta) {
      return 'La fecha de alta es obligatoria.'
    }
    if (isReactivateMode) {
      return ''
    }
    if (data.codigo_telefono.trim() && !/^\d+$/.test(data.codigo_telefono.trim())) {
      return 'El codigo de telefono debe contener solo numeros.'
    }
    if (data.numero_telefono.trim() && !/^\d+$/.test(data.numero_telefono.trim())) {
      return 'El numero de telefono debe contener solo numeros.'
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
    if (!spaceId) {
      return
    }
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
    if (isCreateMode && !preview) {
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

    setSaving(true)
    setFormError('')
    try {
      if (isCreateMode && preview) {
        await createCollaboratorOffline(
          spaceId,
          {
            ciudadano_id: preview.ciudadano_id || undefined,
            dni: !preview.ciudadano_id ? normalized.dni : undefined,
            genero: normalized.genero,
            codigo_telefono: normalized.codigo_telefono,
            numero_telefono: normalized.numero_telefono,
            fecha_alta: normalized.fecha_alta,
            fecha_baja: normalized.fecha_baja || null,
            actividad_ids: normalized.actividad_ids,
          },
          preview,
        )
      } else if (target) {
        const payload: SpaceCollaboratorPayload = {
          genero: isReactivateMode ? target.genero : normalized.genero,
          codigo_telefono: isReactivateMode ? target.codigo_telefono : normalized.codigo_telefono,
          numero_telefono: isReactivateMode ? target.numero_telefono : normalized.numero_telefono,
          fecha_alta: normalized.fecha_alta,
          fecha_baja: isReactivateMode ? null : normalized.fecha_baja || null,
          actividad_ids: isReactivateMode ? target.actividades.map((activity) => activity.id) : normalized.actividad_ids,
        }
        await updateCollaboratorOffline(target, payload, activityOptions)
      }
      void syncNow()
      backToList()
    } catch (error) {
      setFormError(
        parseApiError(
          error,
          'No se pudo guardar el colaborador.',
          'La operacion esta demorando. Intentá nuevamente en unos segundos.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!target || deleting) {
      return
    }
    setDeleting(true)
    setFormError('')
    try {
      await deleteCollaboratorOffline(target)
      void syncNow()
      backToList()
    } catch (error) {
      setFormError(
        parseApiError(
          error,
          'No se pudo dar de baja el colaborador.',
          'La operacion esta demorando. Intentá nuevamente en unos segundos.',
        ),
      )
    } finally {
      setDeleting(false)
      setConfirmDeleteOpen(false)
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

  return (
    <section className="pb-24">
      <form onSubmit={(event) => void handleSubmit(event)} className={`grid gap-3 rounded-xl border p-4 ${cardClass}`}>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>{title}</h2>

        {!isCreateMode && target ? (
          <div className={`rounded-lg border p-3 text-sm ${cardClass}`}>
            <p className={`font-semibold ${textClass}`}>{target.apellido}, {target.nombre}</p>
            <p className={detailTextClass}>DNI {target.dni}</p>
            <p className={detailTextClass}>Baja actual: {formatLatinDate(target.fecha_baja)}</p>
          </div>
        ) : null}

        {isCreateMode && !preview ? (
          <input
            className={inputBaseClass}
            placeholder="DNI"
            value={formData.dni}
            onChange={(event) => setFormData((current) => ({ ...current, dni: event.target.value }))}
          />
        ) : null}

        {preview ? (
          <div className={`rounded-lg border p-3 text-sm ${cardClass}`}>
            <p className={`font-semibold ${textClass}`}>{preview.apellido}, {preview.nombre}</p>
            <p className={detailTextClass}>DNI {preview.dni}</p>
            <p className={detailTextClass}>Fecha nacimiento: {formatLatinDate(preview.fecha_nacimiento)}</p>
          </div>
        ) : null}

        {isReactivateMode ? (
          <div className="grid gap-1">
            <label className={`text-[12px] font-semibold ${textClass}`}>Fecha de alta</label>
            <input
              type="date"
              value={formData.fecha_alta}
              onChange={(event) => setFormData((current) => ({ ...current, fecha_alta: event.target.value }))}
              className={inputBaseClass}
            />
          </div>
        ) : isEditMode || preview ? (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-1">
                <label className={`text-[12px] font-semibold ${textClass}`}>Genero</label>
                <select
                  value={formData.genero}
                  onChange={(event) => setFormData((current) => ({ ...current, genero: event.target.value }))}
                  className={selectBaseClass}
                >
                  {genderOptions.map((option) => (
                    <option key={option.id} value={option.id} className={selectOptionClass}>{option.label}</option>
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
                <label className={`text-[12px] font-semibold ${textClass}`}>Codigo telefono</label>
                <input
                  value={formData.codigo_telefono}
                  onChange={(event) => setFormData((current) => ({ ...current, codigo_telefono: event.target.value }))}
                  className={inputBaseClass}
                />
              </div>
              <div className="grid gap-1">
                <label className={`text-[12px] font-semibold ${textClass}`}>Numero telefono</label>
                <input
                  value={formData.numero_telefono}
                  onChange={(event) => setFormData((current) => ({ ...current, numero_telefono: event.target.value }))}
                  className={inputBaseClass}
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

            <div className={`grid gap-2 rounded-lg border p-3 ${cardClass}`}>
              <p className={`text-[12px] font-semibold ${textClass}`}>Actividades</p>
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
          </>
        ) : null}

        {isReactivateMode && selectedActivities.length > 0 ? (
          <p className={`text-[12px] ${detailTextClass}`}>
            Se reactivara con sus actividades actuales: {selectedActivities.map((activity) => activity.nombre).join(', ')}
          </p>
        ) : null}

        {formError ? (
          <div className="rounded-lg border border-[#F2B8B5] bg-[#7A1C1C]/50 p-3 text-sm text-white">
            {formError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={backToList} className={`rounded-full border px-3 py-1 text-xs font-semibold ${detailTextClass}`}>
            Cancelar
          </button>
          {isCreateMode && preview ? (
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#232D4F]"
            >
              Cancelar validacion
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
      {isEditMode && target?.activo ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting || saving}
            className="w-full rounded-2xl bg-[#C62828] px-4 py-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(198,40,40,0.25)] disabled:opacity-60"
          >
            {deleting ? 'Dando de baja...' : 'Dar de baja colaborador'}
          </button>
        </div>
      ) : null}
      <ConfirmActionModal
        open={confirmDeleteOpen}
        title="Confirmar baja de colaborador"
        message={
          target
            ? `Se va a dar de baja a ${target.nombre} ${target.apellido} en este espacio.`
            : ''
        }
        confirmLabel="Dar de baja"
        loading={deleting}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  )
}
