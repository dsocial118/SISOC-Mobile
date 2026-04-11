import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import {
  listSpaceNomina,
  syncNominaAlimentariaAttendance,
  type NominaPerson,
} from '../../api/nominaApi'
import { AppToast } from '../../ui/AppToast'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { appButtonClass, joinClasses } from '../../ui/buttons'

export function SpaceNominaAlimentariaAttendancePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState = (location.state as { spaceName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [periodLabel, setPeriodLabel] = useState('')
  const [rows, setRows] = useState<NominaPerson[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [lockedIds, setLockedIds] = useState<Set<number>>(new Set())

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

  useEffect(() => {
    let isMounted = true

    async function loadRows() {
      if (!spaceId) {
        setErrorMessage('No se encontró el espacio seleccionado.')
        setLoading(false)
        return
      }

      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        const response = await listSpaceNomina(spaceId, { tab: 'alimentaria' })
        if (!isMounted) {
          return
        }
        setRows(response.results)
        setSelectedIds(response.results.map((row) => row.id))
        const currentPeriod = response.results.find(
          (row) => row.asistencia_mes_actual,
        )?.asistencia_mes_actual?.periodo_label
        setPeriodLabel(
          currentPeriod
            || new Intl.DateTimeFormat('es-AR', {
              month: '2-digit',
              year: 'numeric',
            }).format(new Date()),
        )
        setLockedIds(
          new Set(
            response.results
              .filter((row) => row.asistencia_mes_actual !== null)
              .map((row) => row.id),
          ),
        )
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar la asistencia alimentaria.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadRows()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [setPageLoading, spaceId])

  const freeIds = useMemo(
    () => rows.map((row) => row.id).filter((id) => !lockedIds.has(id)),
    [rows, lockedIds],
  )
  const allFreeSelected =
    freeIds.length > 0 && freeIds.every((id) => selectedIds.includes(id))
  const lockedCount = lockedIds.size
  const totalCount = rows.length
  const lockedPercentage = totalCount > 0 ? Math.round((lockedCount / totalCount) * 100) : 0

  function toggleRow(rowId: number) {
    if (lockedIds.has(rowId)) {
      return
    }
    setSelectedIds((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId],
    )
  }

  async function handleSave() {
    if (!spaceId || saving) {
      return
    }
    setSaving(true)
    setErrorMessage('')
    try {
      const result = await syncNominaAlimentariaAttendance(spaceId, selectedIds)
      navigate(`/app-org/espacios/${spaceId}/nomina-alimentaria`, {
        replace: true,
        state: {
          spaceName: routeState?.spaceName,
          attendanceToast: {
            tone: 'success',
            message: `Se guardó la asistencia de la nómina del período ${result.periodo_label}.`,
          },
        },
      })
    } catch (error) {
      setErrorMessage(parseApiError(error, 'No se pudo guardar la asistencia alimentaria.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return null
  }

  return (
    <section className="grid gap-3 pb-24">
      <AppToast
        open={Boolean(errorMessage)}
        message={errorMessage}
        tone="error"
        onClose={() => setErrorMessage('')}
      />

      <div>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Asistencia alimentaria</h2>
        <p className={`mt-1 text-sm ${detailTextClass}`}>
          {routeState?.spaceName ? `${routeState.spaceName} · ` : ''}
          Período {periodLabel}
        </p>
      </div>

      {totalCount > 0 ? (
        <div className="grid gap-1">
          <div className={`flex items-center justify-between text-xs ${detailTextClass}`}>
            <span>Asistencia registrada</span>
            <span className="font-semibold">
              {lockedCount}/{totalCount}
            </span>
          </div>
          <div className={`h-2.5 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
            <div
              className="h-full rounded-full bg-[#2E7D33] transition-[width] duration-300"
              style={{ width: `${lockedPercentage}%` }}
            />
          </div>
        </div>
      ) : null}

      <div
        className={`rounded-xl border px-4 py-3 ${isDark ? 'border-white/15 bg-[#232D4F]' : 'border-[#E0E0E0] bg-[#F5F5F5]'}`}
        style={cardStyle}
      >
        <label
          className={`flex items-center gap-3 ${freeIds.length === 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        >
          <input
            type="checkbox"
            checked={freeIds.length === 0 ? true : allFreeSelected}
            onChange={(event) =>
              setSelectedIds(
                event.target.checked
                  ? [...Array.from(lockedIds), ...freeIds]
                  : Array.from(lockedIds),
              )
            }
            disabled={freeIds.length === 0}
            className="h-4 w-4 accent-[#2E7D33] disabled:opacity-50"
          />
          <span className={`text-[14px] font-semibold ${textClass}`}>Seleccionar todo</span>
        </label>
      </div>

      {rows.length === 0 ? (
        <div className={`rounded-xl border p-4 text-sm ${detailTextClass}`} style={cardStyle}>
          No hay personas vinculadas a prestaciones alimentarias en este espacio.
        </div>
      ) : (
        <div
          className={`rounded-xl border px-4 py-2 ${isDark ? 'border-white/15 bg-[#232D4F]' : 'border-[#E0E0E0] bg-[#F5F5F5]'}`}
          style={cardStyle}
        >
          {rows.map((row) => {
            const checked = selectedIds.includes(row.id)
            const locked = lockedIds.has(row.id)
            return (
              <div key={row.id}>
                <label
                  className={`flex items-center gap-3 py-3 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRow(row.id)}
                    disabled={locked}
                    className="h-4 w-4 accent-[#2E7D33] disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[15px] font-semibold ${locked ? 'opacity-60' : ''} ${textClass}`}
                    >
                      {row.apellido}, {row.nombre}
                    </p>
                    <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                      DNI: {row.dni || 'Sin documento'}
                    </p>
                  </div>
                  {locked ? (
                    <span className="shrink-0 rounded-full bg-[#2E7D33]/20 px-2 py-0.5 text-[10px] font-semibold text-[#2E7D33]">
                      Ya registrada
                    </span>
                  ) : null}
                </label>
                {row.id !== rows[rows.length - 1]?.id ? (
                  <hr className={isDark ? 'border-white/10' : 'border-slate-300'} />
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className={joinClasses(
          'mt-2',
          appButtonClass({ variant: 'success', size: 'lg', fullWidth: true }),
        )}
      >
        {saving ? 'Guardando asistencia...' : 'Guardar asistencia'}
      </button>
    </section>
  )
}
