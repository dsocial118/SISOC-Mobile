import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import { syncNow } from '../../sync/engine'
import { useAppTheme } from '../../ui/theme'
import { createRendicionOffline } from './rendicionOffline'

export function SpaceRendicionFormPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as
      | {
          spaceName?: string
          programName?: string
          projectName?: string
          organizationName?: string
        }
      | null) ?? null

  const [convenio, setConvenio] = useState('')
  const [numeroRendicion, setNumeroRendicion] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFin, setPeriodoFin] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const titleClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const subtitleClass = isDark ? 'text-white/80' : 'text-slate-600'
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
  const inputClass = isDark
    ? 'border-white/20 bg-white/10 text-white placeholder:text-white/60'
    : 'border-slate-300 bg-white text-slate-700 placeholder:text-slate-400'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!spaceId) {
      setErrorMessage('No se encontró el espacio seleccionado.')
      return
    }
    setSaving(true)
    setErrorMessage('')
    try {
      const created = await createRendicionOffline(spaceId, {
        convenio,
        numero_rendicion: Number(numeroRendicion),
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        observaciones,
      })
      void syncNow()
      navigate(`/app-org/espacios/${spaceId}/rendicion/${created.id}`, {
        replace: true,
        state: routeState,
      })
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo crear la rendición.'))
      setSaving(false)
    }
  }

  return (
    <section className="grid gap-3">
      <div>
        <h2 className={`text-[16px] font-semibold ${titleClass}`}>Nueva rendición</h2>
        <p className={`mt-1 text-sm ${subtitleClass}`}>
          Cargá los datos generales para iniciar la presentación.
        </p>
      </div>

      {routeState?.organizationName && (routeState?.projectName || routeState?.programName) ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${subtitleClass}`} style={cardStyle}>
          {routeState.organizationName} · {routeState.projectName || routeState.programName}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-[#C62828]/20 bg-[#C62828]/10 p-4 text-sm text-[#C62828]">
          {errorMessage}
        </div>
      ) : null}

      <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
        <article className="rounded-xl border p-4" style={cardStyle}>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className={`text-[12px] font-semibold ${titleClass}`}>Convenio</span>
              <input
                value={convenio}
                onChange={(event) => setConvenio(event.target.value)}
                className={`rounded-xl border px-3 py-3 text-sm outline-none ${inputClass}`}
                placeholder="Ej. CONV-2026-01"
                required
              />
            </label>

            <label className="grid gap-1">
              <span className={`text-[12px] font-semibold ${titleClass}`}>
                Número de rendición
              </span>
              <input
                value={numeroRendicion}
                onChange={(event) => setNumeroRendicion(event.target.value)}
                className={`rounded-xl border px-3 py-3 text-sm outline-none ${inputClass}`}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ej. 1"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className={`text-[12px] font-semibold ${titleClass}`}>Fecha inicio</span>
                <input
                  type="date"
                  value={periodoInicio}
                  onChange={(event) => setPeriodoInicio(event.target.value)}
                  className={`rounded-xl border px-3 py-3 text-sm outline-none ${inputClass}`}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className={`text-[12px] font-semibold ${titleClass}`}>Fecha fin</span>
                <input
                  type="date"
                  value={periodoFin}
                  onChange={(event) => setPeriodoFin(event.target.value)}
                  className={`rounded-xl border px-3 py-3 text-sm outline-none ${inputClass}`}
                  required
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className={`text-[12px] font-semibold ${titleClass}`}>Observaciones</span>
              <textarea
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                className={`min-h-[100px] rounded-xl border px-3 py-3 text-sm outline-none ${inputClass}`}
                placeholder="Opcional"
              />
            </label>
          </div>
        </article>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl bg-[#232D4F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Continuar con documentación'}
        </button>
      </form>
    </section>
  )
}
