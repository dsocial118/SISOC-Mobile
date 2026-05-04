import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import { syncNow } from '../../sync/engine'
import { appButtonClass } from '../../ui/buttons'
import { useAppTheme } from '../../ui/ThemeContext'
import { createRendicionOffline, listOfflineRendiciones } from './rendicionOffline'

function toComparableDate(value: string | null | undefined): number | null {
  const raw = String(value || '').trim()
  if (!raw) {
    return null
  }
  const parsed = new Date(`${raw}T00:00:00`)
  const time = parsed.getTime()
  return Number.isNaN(time) ? null : time
}

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
      setErrorMessage('No se encontr? el espacio seleccionado.')
      return
    }
    setSaving(true)
    setErrorMessage('')
    try {
      const inicioTs = toComparableDate(periodoInicio)
      const finTs = toComparableDate(periodoFin)
      if (!inicioTs || !finTs) {
        setErrorMessage('Completá un período válido.')
        setSaving(false)
        return
      }
      if (finTs < inicioTs) {
        setErrorMessage('La fecha fin no puede ser anterior a la fecha inicio.')
        setSaving(false)
        return
      }

      const existingRows = await listOfflineRendiciones(spaceId)
      const hasOverlappingPeriod = existingRows.some((row) => {
        const rowInicioTs = toComparableDate(row.periodo_inicio)
        const rowFinTs = toComparableDate(row.periodo_fin)
        if (!rowInicioTs || !rowFinTs) {
          return false
        }
        return inicioTs <= rowFinTs && finTs >= rowInicioTs
      })

      if (hasOverlappingPeriod) {
        setErrorMessage('Ya existe una rendición cargada para ese período.')
        setSaving(false)
        return
      }

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
      setErrorMessage(parseApiError(error, 'No se pudo crear la rendicion.'))
      setSaving(false)
    }
  }

  return (
    <section className="grid gap-3">
      <div>
        <h2 className={`text-[16px] font-semibold ${titleClass}`}>Nueva rendicion</h2>
        <p className={`mt-1 text-sm ${subtitleClass}`}>
          Carg? los datos generales para iniciar la presentaci?n.
        </p>
      </div>

      {routeState?.organizationName && (routeState?.projectName || routeState?.programName) ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${subtitleClass}`} style={cardStyle}>
          {routeState.organizationName} - {routeState.projectName || routeState.programName}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 p-4 text-sm text-white">
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
                N?mero de rendicion
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
          className={appButtonClass({ variant: 'success', size: 'lg', fullWidth: true })}
        >
          {saving ? 'Guardando...' : 'Continuar con documentaci?n'}
        </button>
      </form>
    </section>
  )
}



