import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import {
  createNominaPerson,
  listNominaGenders,
  previewNominaDni,
  type CreateNominaPayload,
  type NominaGender,
  type NominaRenaperPreview,
} from '../../api/nominaApi'
import { syncNow } from '../../sync/engine'
import { appButtonClass, joinClasses } from '../../ui/buttons'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

type FormState = {
  nombre: string
  apellido: string
  dni: string
  sexo_id: string
  fecha_nacimiento: string
  es_indocumentado: boolean
}

const EMPTY_FORM: FormState = {
  nombre: '',
  apellido: '',
  dni: '',
  sexo_id: '',
  fecha_nacimiento: '',
  es_indocumentado: false,
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

export function SpaceNominaAlimentariaPersonFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as { spaceName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewingRenaper, setPreviewingRenaper] = useState(false)
  const [genders, setGenders] = useState<NominaGender[]>([])
  const [renaperPreview, setRenaperPreview] = useState<NominaRenaperPreview | null>(null)
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)

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
        const gendersResult = await listNominaGenders(spaceId)
        if (!isMounted) {
          return
        }
        setGenders(gendersResult)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar el formulario.'))
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
  }, [setPageLoading, spaceId])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!spaceId) {
      return
    }

    const normalizedDni = formData.dni.replace(/\D/g, '')
    if (!formData.es_indocumentado && !renaperPreview) {
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
      const payload: Partial<CreateNominaPayload> = {
        asistencia_alimentaria: true,
        asistencia_actividades: false,
        actividad_ids: [],
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

      const created = await createNominaPerson(spaceId, payload as CreateNominaPayload)
      void syncNow()
      navigate(`/app-org/espacios/${spaceId}/nomina-alimentaria`, {
        replace: true,
        state: {
          spaceName: routeState?.spaceName,
          successToast: {
            tone: 'success',
            message: `Se agregó a ${created.apellido}, ${created.nombre} a la nómina alimentaria.`,
          },
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
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Alta de persona</h2>
        <p className={`mt-1 text-sm ${detailTextClass}`}>
          {routeState?.spaceName ? `${routeState.spaceName} · ` : ''}
          Nómina alimentaria
        </p>
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className={`grid gap-3 rounded-xl border p-3 ${subCardClass}`}
        style={cardStyle}
      >
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

        {formData.es_indocumentado ? (
          <div className="grid gap-2">
            <input
              placeholder="Nombre"
              value={formData.nombre}
              onChange={(event) =>
                setFormData((current) => ({ ...current, nombre: event.target.value }))
              }
              className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${
                isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            />
            <input
              placeholder="Apellido"
              value={formData.apellido}
              onChange={(event) =>
                setFormData((current) => ({ ...current, apellido: event.target.value }))
              }
              className={`rounded-lg border px-3 py-2 text-[16px] outline-none ${
                isDark ? 'border-white/30 bg-white/10 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            />
            <div
              className={`grid gap-1 rounded-lg border px-3 py-2 ${
                isDark ? 'border-white/30 bg-white/10' : 'border-slate-300 bg-white'
              }`}
            >
              <p className={`text-[12px] font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>
                Género
              </p>
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
                      {selected ? (
                        <FontAwesomeIcon icon={faCheck} aria-hidden="true" style={{ fontSize: 11 }} />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid gap-1">
              <label
                className={`text-[12px] font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}
              >
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
        ) : (
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
        )}

        {!formData.es_indocumentado && renaperPreview ? (
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

        {formError ? <p className="text-xs text-[#C62828]">{formError}</p> : null}

        <div className="flex justify-end gap-2">
          {!formData.es_indocumentado && renaperPreview ? (
            <button
              type="button"
              onClick={() => setRenaperPreview(null)}
              className={joinClasses(
                appButtonClass({ variant: 'outline-secondary', size: 'sm' }),
                isDark ? 'border-white/40 bg-white text-[#232D4F]' : undefined,
              )}
            >
              Cancelar validación
            </button>
          ) : null}
          <button
            type="submit"
            disabled={saving || previewingRenaper}
            className={appButtonClass({ variant: 'primary', size: 'md' })}
          >
            {previewingRenaper
              ? 'Consultando RENAPER...'
              : saving
                ? 'Guardando...'
                : !formData.es_indocumentado && !renaperPreview
                  ? 'Validar DNI'
                  : 'Guardar'}
          </button>
        </div>
      </form>
    </section>
  )
}
