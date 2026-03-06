import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { AxiosError } from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import type { SpaceCollaboratorPayload } from '../../api/collaboratorsApi'
import type { SpaceCollaboratorRecord } from '../../db/database'
import {
  createCollaboratorOffline,
  deleteCollaboratorOffline,
  listLocalSpaceCollaborators,
  mergeRemoteCollaborators,
  updateCollaboratorOffline,
} from './collaboratorsOffline'
import { syncNow } from '../../sync/engine'

const DNI_REGEX = /^\d{7,8}$/
const PHONE_REGEX = /^[\d+\-() ]{6,30}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const EMPTY_FORM: SpaceCollaboratorPayload = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  email: '',
  rol_funcion: '',
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
  const [formData, setFormData] = useState<SpaceCollaboratorPayload>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const collaborators = useLiveQuery(
    async () => listLocalSpaceCollaborators(spaceId),
    [spaceId],
  )

  const submitLabel = editingId ? 'Guardar cambios' : 'Guardar colaborador'
  const panelTitle = editingId ? 'Editar colaborador' : 'Alta de colaborador'

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      setRefreshError('')
      try {
        await mergeRemoteCollaborators(spaceId)
      } catch (error) {
        if (!isMounted) {
          return
        }
        const statusCode = (error as AxiosError)?.response?.status
        if (statusCode === 403 || statusCode === 404) {
          setRefreshError('')
          return
        }
        setRefreshError(parseApiError(error, 'No se pudieron actualizar colaboradores desde la web.'))
      }
    }

    void bootstrap()
    return () => {
      isMounted = false
    }
  }, [spaceId])

  function openCreateForm() {
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setFormError('')
    setFormOpen(true)
  }

  function openEditForm(item: SpaceCollaboratorRecord) {
    setEditingId(item.id)
    setFormData({
      nombre: item.nombre,
      apellido: item.apellido,
      dni: item.dni,
      telefono: item.telefono,
      email: item.email,
      rol_funcion: item.rol_funcion,
    })
    setFormError('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setFormData(EMPTY_FORM)
    setFormError('')
  }

  const currentRows = useMemo(() => collaborators ?? [], [collaborators])

  function toggleExpanded(collaboratorId: string) {
    setExpandedIds((current) => ({
      ...current,
      [collaboratorId]: !current[collaboratorId],
    }))
  }

  function validateForm(data: SpaceCollaboratorPayload): string {
    if (!data.nombre.trim() || !data.apellido.trim() || !data.dni.trim() || !data.telefono.trim() || !data.email.trim() || !data.rol_funcion.trim()) {
      return 'Todos los campos son obligatorios.'
    }
    if (!DNI_REGEX.test(data.dni.trim())) {
      return 'El DNI debe tener 7 u 8 dígitos.'
    }
    if (!EMAIL_REGEX.test(data.email.trim())) {
      return 'Formato de email inválido.'
    }
    if (!PHONE_REGEX.test(data.telefono.trim())) {
      return 'Formato de teléfono inválido.'
    }

    const dni = data.dni.trim()
    const duplicate = currentRows.some((row) => row.dni === dni && row.id !== editingId)
    if (duplicate) {
      return 'Ya existe un colaborador activo con ese DNI en este espacio.'
    }

    return ''
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized: SpaceCollaboratorPayload = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim(),
      dni: formData.dni.trim(),
      telefono: formData.telefono.trim(),
      email: formData.email.trim().toLowerCase(),
      rol_funcion: formData.rol_funcion.trim(),
    }

    const validationError = validateForm(normalized)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        const editing = currentRows.find((row) => row.id === editingId)
        if (!editing) {
          setFormError('No se encontró el colaborador a editar.')
          return
        }
        await updateCollaboratorOffline(editing, normalized)
      } else {
        await createCollaboratorOffline(spaceId, normalized)
      }
      closeForm()
      void syncNow()
    } catch (error) {
      setFormError(parseApiError(error, 'No se pudo guardar el colaborador.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: SpaceCollaboratorRecord) {
    const confirmed = window.confirm(
      `¿Eliminar lógicamente a ${item.nombre} ${item.apellido}?`,
    )
    if (!confirmed) {
      return
    }

    try {
      await deleteCollaboratorOffline(item)
      if (editingId === item.id) {
        closeForm()
      }
      void syncNow()
    } catch (error) {
      setFormError(parseApiError(error, 'No se pudo eliminar el colaborador.'))
    }
  }

  const inputBaseClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDark ? 'border-white/30 bg-white/10 text-white placeholder:text-white/60' : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400'}`

  return (
    <article
      className="progressive-card rounded-[15px] border p-5"
      style={{ ...cardStyle, ['--card-delay' as string]: '210ms' }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos de Colaboradores</h2>
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
        >
          <p className={`text-sm font-semibold ${textClass}`}>{panelTitle}</p>
          <input
            className={inputBaseClass}
            placeholder="Nombre"
            value={formData.nombre}
            onChange={(event) => setFormData((current) => ({ ...current, nombre: event.target.value }))}
          />
          <input
            className={inputBaseClass}
            placeholder="Apellido"
            value={formData.apellido}
            onChange={(event) => setFormData((current) => ({ ...current, apellido: event.target.value }))}
          />
          <input
            className={inputBaseClass}
            placeholder="DNI"
            value={formData.dni}
            onChange={(event) => setFormData((current) => ({ ...current, dni: event.target.value }))}
          />
          <input
            className={inputBaseClass}
            placeholder="Teléfono"
            value={formData.telefono}
            onChange={(event) => setFormData((current) => ({ ...current, telefono: event.target.value }))}
          />
          <input
            className={inputBaseClass}
            placeholder="Email"
            value={formData.email}
            onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
          />
          <input
            className={inputBaseClass}
            placeholder="Rol/Función"
            value={formData.rol_funcion}
            onChange={(event) => setFormData((current) => ({ ...current, rol_funcion: event.target.value }))}
          />
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

      {refreshError ? (
        <p className={`mt-3 text-sm ${detailTextClass}`}>{refreshError}</p>
      ) : null}

      {collaborators === undefined ? (
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
                  <p className="mt-0.5 truncate text-[12px]">{collaborator.rol_funcion}</p>
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
                  expandedIds[collaborator.id] ? 'mt-2 max-h-[220px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className={`grid gap-1 text-[13px] ${detailTextClass}`}>
                  <p><span className={`font-semibold ${textClass}`}>DNI:</span> {collaborator.dni}</p>
                  <p><span className={`font-semibold ${textClass}`}>Mail:</span> {collaborator.email}</p>
                  <p><span className={`font-semibold ${textClass}`}>Teléfono:</span> {collaborator.telefono}</p>
                  {collaborator.last_error ? (
                    <p className="text-xs text-[#C62828]">{collaborator.last_error}</p>
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
                    onClick={() => void handleDelete(collaborator)}
                    className="rounded-full bg-[#C62828] px-3 py-1 text-xs font-semibold text-white"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
