import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrashCan, faUserShield } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useParams } from 'react-router-dom'
import {
  createSpaceUser,
  deactivateSpaceUser,
  listSpaceUsers,
  updateSpaceUserPermissions,
  type AssignableSpaceUserSpace,
  type SpaceUserItem,
} from '../../api/spaceUsersApi'
import { parseApiError } from '../../api/errorUtils'
import { AppToast } from '../../ui/AppToast'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'
import { appButtonClass, joinClasses } from '../../ui/buttons'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { useAuth } from '../../auth/useAuth'

const PERMISSION_LABELS: Record<string, string> = {
  'rendicioncuentasmensual.manage_mobile_rendicion': 'Rendiciones',
  'pwa.manage_prestaciones_mensuales_pwa': 'Prestaciones mensuales',
  'pwa.manage_nomina_pwa': 'Nómina',
  'pwa.manage_colaboradores_pwa': 'Colaboradores',
}

type FormState = {
  username: string
  email: string
  password: string
  comedor_ids: number[]
  permission_codes: string[]
}

const EMPTY_FORM: FormState = {
  username: '',
  email: '',
  password: '',
  comedor_ids: [],
  permission_codes: [],
}

export function SpaceUsersPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const location = useLocation()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const { userProfile } = useAuth()
  const routeState = (location.state as { spaceName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [users, setUsers] = useState<SpaceUserItem[]>([])
  const [assignablePermissions, setAssignablePermissions] = useState<string[]>([])
  const [assignableSpaces, setAssignableSpaces] = useState<AssignableSpaceUserSpace[]>([])
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [pendingDeactivate, setPendingDeactivate] = useState<SpaceUserItem | null>(null)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<string[]>([])
  const [savingPermissions, setSavingPermissions] = useState(false)

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
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
  const inputClass = joinClasses(
    'w-full rounded-xl border px-3 py-2 text-sm outline-none',
    isDark
      ? 'border-white/20 bg-white/10 text-white placeholder:text-white/55'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400',
  )

  async function loadUsers() {
    if (!spaceId) {
      return
    }
    setPageLoading(true)
    setLoading(true)
    try {
      const response = await listSpaceUsers(spaceId)
      setUsers(response.results)
      const nextAssignablePermissions = response.assignable_permission_codes
      setAssignablePermissions(nextAssignablePermissions)
      setAssignableSpaces(response.assignable_comedores)
      const currentSpaceId = Number(spaceId)
      const defaultSpaceIds = response.assignable_comedores.some((item) => item.id === currentSpaceId)
        ? [currentSpaceId]
        : response.assignable_comedores.slice(0, 1).map((item) => item.id)
      setForm((current) => ({
        ...current,
        comedor_ids: current.comedor_ids.length > 0 ? current.comedor_ids : defaultSpaceIds,
        permission_codes: current.permission_codes.filter((code) => nextAssignablePermissions.includes(code)),
      }))
    } catch (error) {
      setToast({ tone: 'error', message: parseApiError(error, 'No se pudieron cargar usuarios.') })
    } finally {
      setLoading(false)
      setPageLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
    return () => setPageLoading(false)
  }, [spaceId])

  function togglePermission(code: string) {
    setForm((current) => ({
      ...current,
      permission_codes: current.permission_codes.includes(code)
        ? current.permission_codes.filter((item) => item !== code)
        : [...current.permission_codes, code],
    }))
  }

  function toggleSpace(comedorId: number) {
    setForm((current) => ({
      ...current,
      comedor_ids: current.comedor_ids.includes(comedorId)
        ? current.comedor_ids.filter((item) => item !== comedorId)
        : [...current.comedor_ids, comedorId],
    }))
  }

  function toggleEditingPermission(code: string) {
    setEditingPermissions((current) => (
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code]
    ))
  }

  function formatUserSpaces(user: SpaceUserItem): string {
    const names = user.comedor_ids
      .map((comedorId) => assignableSpaces.find((item) => item.id === comedorId)?.nombre || `#${comedorId}`)
      .filter(Boolean)
    return names.length > 0 ? names.join(', ') : '-'
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!spaceId || saving) {
      return
    }
    setSaving(true)
    try {
      await createSpaceUser(spaceId, {
        ...form,
      })
      setForm(EMPTY_FORM)
      setFormOpen(false)
      setToast({ tone: 'success', message: 'Usuario creado correctamente.' })
      await loadUsers()
    } catch (error) {
      setToast({ tone: 'error', message: parseApiError(error, 'No se pudo crear el usuario.') })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!spaceId || !pendingDeactivate) {
      return
    }
    try {
      await deactivateSpaceUser(spaceId, pendingDeactivate.id)
      setPendingDeactivate(null)
      setToast({ tone: 'success', message: 'Usuario desactivado.' })
      await loadUsers()
    } catch (error) {
      setToast({ tone: 'error', message: parseApiError(error, 'No se pudo desactivar el usuario.') })
    }
  }

  async function handleSavePermissions(user: SpaceUserItem) {
    if (!spaceId || savingPermissions) {
      return
    }
    setSavingPermissions(true)
    try {
      await updateSpaceUserPermissions(spaceId, user.id, editingPermissions)
      setEditingUserId(null)
      setEditingPermissions([])
      setToast({ tone: 'success', message: 'Permisos actualizados.' })
      await loadUsers()
    } catch (error) {
      setToast({ tone: 'error', message: parseApiError(error, 'No se pudieron actualizar permisos.') })
    } finally {
      setSavingPermissions(false)
    }
  }

  if (loading) {
    return null
  }

  return (
    <section className="grid gap-3 pb-24">
      <AppToast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />

      <article className="rounded-[15px] border p-5" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className={`text-[16px] font-semibold ${textClass}`}>Usuarios responsables del Espacio Comunitario</h2>
            <p className={`mt-1 text-xs ${detailTextClass}`}>
              {routeState?.spaceName ? `${routeState.spaceName} · ` : ''}
              Subusuarios asignados a este espacio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((current) => !current)}
            className={appButtonClass({ variant: 'success', size: 'sm' })}
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            Agregar
          </button>
        </div>

        {formOpen ? (
          <form className="mt-4 grid gap-3" onSubmit={(event) => void handleCreate(event)}>
            <input
              className={inputClass}
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="Usuario"
            />
            <input
              className={inputClass}
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email (opcional)"
              type="email"
            />
            <input
              className={inputClass}
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Contraseña inicial"
              type="password"
            />
            {assignableSpaces.length > 0 ? (
              <div className="grid gap-2">
                <p className={`text-[12px] font-semibold ${textClass}`}>Espacios</p>
                {assignableSpaces.map((space) => (
                  <label key={space.id} className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}>
                    <input
                      type="checkbox"
                      checked={form.comedor_ids.includes(space.id)}
                      onChange={() => toggleSpace(space.id)}
                    />
                    <span>{space.nombre || `Espacio #${space.id}`}</span>
                  </label>
                ))}
              </div>
            ) : null}
            {assignablePermissions.length > 0 ? (
              <div className="grid gap-2">
                <p className={`text-[12px] font-semibold ${textClass}`}>Permisos</p>
                {assignablePermissions.map((code) => (
                  <label key={code} className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}>
                    <input
                      type="checkbox"
                      checked={form.permission_codes.includes(code)}
                      onChange={() => togglePermission(code)}
                    />
                    <span>{PERMISSION_LABELS[code] || code}</span>
                  </label>
                ))}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={saving || form.comedor_ids.length === 0}
              className={appButtonClass({ variant: 'success', size: 'md', fullWidth: true })}
            >
              {saving ? 'Guardando...' : 'Crear usuario'}
            </button>
          </form>
        ) : null}
      </article>

      {users.length === 0 ? (
        <p className={`text-sm ${detailTextClass}`}>No hay usuarios asignados.</p>
      ) : (
        <div className="grid gap-3">
          {users.map((user) => (
            <article key={user.id} className="rounded-[15px] border p-4" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate text-[15px] font-semibold ${textClass}`}>{user.username}</p>
                  <p className={`mt-1 truncate text-[12px] ${detailTextClass}`}>
                    {user.email || 'Sin email'}
                  </p>
                  <p className={`mt-1 text-[11px] ${detailTextClass}`}>
                    Creado por {user.creado_por_username || '-'}
                  </p>
                  <p className={`mt-1 text-[11px] ${detailTextClass}`}>
                    Espacios: {formatUserSpaces(user)}
                  </p>
                  {user.permission_codes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {user.permission_codes.map((code) => (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1 rounded-full bg-[#E7BA61]/20 px-2 py-1 text-[10px] font-semibold text-[#E7BA61]"
                        >
                          <FontAwesomeIcon icon={faUserShield} aria-hidden="true" />
                          {PERMISSION_LABELS[code] || code}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={appButtonClass({ variant: 'outline-danger', size: 'sm' })}
                  onClick={() => setPendingDeactivate(user)}
                >
                  <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                </button>
              </div>
              {assignablePermissions.length > 0 && user.creado_por_username === userProfile?.username ? (
                <div className="mt-3 grid gap-2 border-t border-black/10 pt-3">
                  {editingUserId === user.id ? (
                    <>
                      <p className={`text-[12px] font-semibold ${textClass}`}>Editar permisos</p>
                      {assignablePermissions.map((code) => (
                        <label key={code} className={`flex items-center gap-2 text-[12px] ${detailTextClass}`}>
                          <input
                            type="checkbox"
                            checked={editingPermissions.includes(code)}
                            onChange={() => toggleEditingPermission(code)}
                          />
                          <span>{PERMISSION_LABELS[code] || code}</span>
                        </label>
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={savingPermissions}
                          className={appButtonClass({ variant: 'success', size: 'sm' })}
                          onClick={() => void handleSavePermissions(user)}
                        >
                          {savingPermissions ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          className={appButtonClass({ variant: 'outline-secondary', size: 'sm' })}
                          onClick={() => {
                            setEditingUserId(null)
                            setEditingPermissions([])
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={appButtonClass({ variant: 'outline-secondary', size: 'sm' })}
                      onClick={() => {
                        setEditingUserId(user.id)
                        setEditingPermissions(
                          user.permission_codes.filter((code) => assignablePermissions.includes(code)),
                        )
                      }}
                    >
                      Editar permisos
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(pendingDeactivate)}
        title="Desactivar usuario"
        message={pendingDeactivate ? `Se va a desactivar ${pendingDeactivate.username}.` : ''}
        confirmLabel="Desactivar"
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => void handleDeactivate()}
      />
    </section>
  )
}
