import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDay,
  faCheckCircle,
  faUtensils,
  faXmark,
  faUserCheck,
  faXmarkCircle,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useParams } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import {
  getPrestacionesConveniadas,
  PRESTACION_DIAS,
  PRESTACION_TIPOS,
  registrarPrestacionConformidad,
  type PrestacionAlimentariaResponse,
  type PrestacionConformidad,
  type PrestacionDia,
  type PrestacionTipo,
} from '../../api/prestacionesApi'
import { AppToast } from '../../ui/AppToast'
import { appButtonClass, joinClasses } from '../../ui/buttons'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { useAuth } from '../../auth/useAuth'
import { PWA_PRESTACIONES_MENSUALES_PERMISSION } from '../../auth/permissionCodes'

const TIPO_LABELS: Record<PrestacionTipo, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
}

const DIA_LABELS: Record<PrestacionDia, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Sin fecha'
  }
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(Number(year), Number(month) - 1, Number(day)))
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatMonthPeriod(value: string | null | undefined): string {
  if (!value) {
    return 'Sin período'
  }
  const match = value.match(/^(\d{4})-(\d{2})-\d{2}$/)
  if (!match) {
    return formatDate(value)
  }
  const [, year, month] = match
  return `Mes ${Number(month)}/${String(year).slice(-2)}`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Sin fecha'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getApprovedValue(
  data: PrestacionAlimentariaResponse,
  tipo: PrestacionTipo,
  dia: PrestacionDia,
): number {
  const value = data[`aprobadas_${tipo}_${dia}`]
  return typeof value === 'number' ? value : 0
}

function statusClass(conformidad: PrestacionConformidad, isDark: boolean): string {
  if (conformidad.conforme) {
    return isDark ? 'bg-[#2E7D33]/25 text-[#A5D6A7]' : 'bg-[#E8F5E9] text-[#2E7D33]'
  }
  return isDark ? 'bg-[#C62828]/25 text-[#FFCDD2]' : 'bg-[#FDECEC] text-[#C62828]'
}

export function SpacePrestacionesConveniadasPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const location = useLocation()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const { userProfile } = useAuth()
  const routeState =
    (location.state as { spaceName?: string; programName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PrestacionAlimentariaResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [negativeMode, setNegativeMode] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
  const mutedTextClass = isDark ? 'text-white/65' : 'text-slate-500'
  const tableBorderClass = isDark ? 'border-white/15' : 'border-slate-200'
  const selectOptionClass = isDark ? 'bg-[#1E2846] text-white' : 'bg-white text-slate-900'
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
  const canManagePrestaciones = Boolean(
    userProfile?.permissions?.includes(PWA_PRESTACIONES_MENSUALES_PERMISSION),
  )

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (!spaceId) {
        setErrorMessage('No se encontró el espacio seleccionado.')
        setLoading(false)
        return
      }
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      try {
        const response = await getPrestacionesConveniadas(spaceId)
        if (!isMounted) {
          return
        }
        setData(response)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudieron cargar las prestaciones.'))
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
  }, [routeState?.programName, setPageLoading, spaceId])

  const rows = useMemo(() => {
    if (!data) {
      return []
    }
    return PRESTACION_DIAS.map((dia) => {
      const values = PRESTACION_TIPOS.map((tipo) => getApprovedValue(data, tipo, dia))
      return {
        dia,
        values,
        total: values.reduce((sum, value) => sum + value, 0),
      }
    })
  }, [data])

  const totalsByType = useMemo(() => {
    if (!data) {
      return PRESTACION_TIPOS.map((tipo) => ({ tipo, total: 0 }))
    }
    return PRESTACION_TIPOS.map((tipo) => ({
      tipo,
      total: PRESTACION_DIAS.reduce(
        (sum, dia) => sum + getApprovedValue(data, tipo, dia),
        0,
      ),
    }))
  }, [data])

  useEffect(() => {
    if (!data) {
      return
    }
    setSelectedPeriod((current) => current || data.periodo_pendiente || data.periodo_actual)
  }, [data])

  const selectedConformidad = useMemo(() => {
    if (!data || !selectedPeriod) {
      return null
    }
    return data.historial_conformidad.find((item) => item.periodo === selectedPeriod) ?? null
  }, [data, selectedPeriod])

  async function submitConformidad(conforme: boolean) {
    if (
      !canManagePrestaciones
      || !spaceId
      || !data
      || submitting
      || selectedConformidad
      || !selectedPeriod
    ) {
      return
    }
    const trimmedObservaciones = observaciones.trim()
    if (!conforme && !trimmedObservaciones) {
      setNegativeMode(true)
      setToast({ tone: 'error', message: 'Agregá observaciones para no dar conformidad.' })
      return
    }
    setSubmitting(true)
    try {
      const conformidad = await registrarPrestacionConformidad(spaceId, {
        periodo: selectedPeriod,
        conforme,
        observaciones: conforme ? '' : trimmedObservaciones,
      })
      setData({
        ...data,
        conformidad_actual:
          conformidad.periodo === data.periodo_pendiente ? conformidad : data.conformidad_actual,
        conformidad_pendiente:
          conformidad.periodo === data.periodo_pendiente ? false : data.conformidad_pendiente,
        periodos_disponibles: data.periodos_disponibles?.map((item) =>
          item.periodo === conformidad.periodo ? { ...item, registrada: true } : item,
        ),
        historial_conformidad: [conformidad, ...data.historial_conformidad],
      })
      setNegativeMode(false)
      setObservaciones('')
      setToast({ tone: 'success', message: 'Conformidad registrada.' })
    } catch (error) {
      setToast({
        tone: 'error',
        message: parseApiError(error, 'No se pudo registrar la conformidad.'),
      })
    } finally {
      setSubmitting(false)
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
    <section className="grid gap-3 pb-24">
      <AppToast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />

      <div>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Prestaciones conveniadas</h2>
      </div>

      {data ? (
        <>
          {data.conformidad_pendiente ? (
            <div className="rounded-xl border border-[#E7BA61] bg-[#E7BA61]/15 p-3 text-[13px] font-semibold text-[#E7BA61]">
              Tenés pendiente la conformidad del periodo {formatMonthPeriod(data.periodo_pendiente || data.periodo_actual)}.
            </div>
          ) : null}

          <article className="rounded-[15px] border p-4" style={cardStyle}>
            <div className="flex items-start gap-3">
              <FontAwesomeIcon icon={faUserCheck} aria-hidden="true" className={textClass} />
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] font-semibold ${textClass}`}>
                  Periodo de conformidad
                </p>
                <label className={`mt-3 block text-[12px] font-semibold ${textClass}`} htmlFor="periodo-conformidad">
                  Mes a conformar
                </label>
                <select
                  id="periodo-conformidad"
                  value={selectedPeriod}
                  onChange={(event) => {
                    setSelectedPeriod(event.target.value)
                    setNegativeMode(false)
                    setObservaciones('')
                  }}
                  className={joinClasses(
                    'mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none',
                    isDark
                      ? 'border-white/20 bg-[#1E2846] text-white'
                      : 'border-slate-300 bg-white text-slate-900',
                  )}
                >
                  {(data.periodos_disponibles || []).map((item) => (
                    <option key={item.periodo} value={item.periodo} className={selectOptionClass}>
                      {formatMonthPeriod(item.periodo)}{item.registrada ? ' - registrada' : ''}
                    </option>
                  ))}
                </select>
                {selectedConformidad ? (
                  <div className="mt-2 grid gap-2">
                    <span
                      className={`w-fit rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(
                        selectedConformidad,
                        isDark,
                      )}`}
                    >
                      {selectedConformidad.conforme ? 'Conforme' : 'No conforme'}
                    </span>
                    <p className={`text-[12px] ${detailTextClass}`}>
                      Registrado el {formatDateTime(selectedConformidad.creado)} por{' '}
                      {selectedConformidad.usuario_nombre || 'usuario no disponible'}.
                    </p>
                    {selectedConformidad.observaciones ? (
                      <p className="text-[12px] text-[#C62828]">
                        Observaciones: {selectedConformidad.observaciones}
                      </p>
                    ) : null}
                  </div>
                ) : canManagePrestaciones ? (
                  <div className="mt-3 grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void submitConformidad(true)}
                        className={joinClasses(
                          'order-2',
                          appButtonClass({ variant: 'success', size: 'md', fullWidth: true }),
                        )}
                      >
                        <FontAwesomeIcon icon={faCheckCircle} aria-hidden="true" />
                        Sí
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setNegativeMode(true)}
                        className={joinClasses(
                          'order-1',
                          appButtonClass({ variant: 'danger', size: 'md', fullWidth: true }),
                        )}
                      >
                        <FontAwesomeIcon icon={faXmarkCircle} aria-hidden="true" />
                        No
                      </button>
                    </div>
                    {negativeMode ? (
                      <div className="grid gap-2">
                        <label className={`text-[12px] font-semibold ${textClass}`} htmlFor="observaciones-conformidad">
                          Observaciones obligatorias
                        </label>
                        <textarea
                          id="observaciones-conformidad"
                          value={observaciones}
                          onChange={(event) => setObservaciones(event.target.value)}
                          rows={4}
                          className={joinClasses(
                            'w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#C62828]',
                            isDark
                              ? 'border-white/20 bg-white/10 text-white placeholder:text-white/45'
                              : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400',
                          )}
                          placeholder="Indicar el motivo de la no conformidad"
                        />
                        <div className="grid grid-cols-[7fr_3fr] gap-2">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void submitConformidad(false)}
                            className={appButtonClass({ variant: 'danger', size: 'md', fullWidth: true })}
                          >
                            Enviar no conformidad
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => {
                              setNegativeMode(false)
                              setObservaciones('')
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-[#6C757D] bg-white px-4 py-2 text-sm font-semibold text-[#6C757D] shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Cancelar no conformidad"
                          >
                            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className={`mt-3 text-[12px] ${detailTextClass}`}>
                    Podés consultar las prestaciones conveniadas. No tenés permiso para registrar la conformidad mensual.
                  </p>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-[15px] border p-4" style={cardStyle}>
            <div className="flex items-start gap-3">
              <FontAwesomeIcon icon={faCalendarDay} aria-hidden="true" className={textClass} />
              <div>
                <p className={`text-[14px] font-semibold ${textClass}`}>Último informe técnico</p>
                <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                  Fecha de finalización: {formatDate(data.fecha_finalizacion || data.modificado || data.creado)}
                </p>
              </div>
            </div>
          </article>

          <div className="grid grid-cols-2 gap-2">
            {totalsByType.map((item) => (
              <article key={item.tipo} className="rounded-xl border p-3" style={cardStyle}>
                <p className={`text-[12px] ${mutedTextClass}`}>
                  {TIPO_LABELS[item.tipo]} semanal
                </p>
                <p className={`mt-1 text-[20px] font-semibold ${textClass}`}>{item.total}</p>
              </article>
            ))}
          </div>

          <article className="rounded-[15px] border p-4" style={cardStyle}>
            <div className="mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faUtensils} aria-hidden="true" className={textClass} />
              <p className={`text-[14px] font-semibold ${textClass}`}>Aprobadas por día</p>
            </div>
            <div className={`divide-y ${isDark ? 'divide-white/15' : 'divide-slate-200'}`}>
              {rows.map((row) => (
                <div key={row.dia} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-[13px] font-semibold ${textClass}`}>
                      {DIA_LABELS[row.dia]}
                    </p>
                    <p className={`shrink-0 text-[13px] font-semibold ${textClass}`}>
                      Total {row.total}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                    {PRESTACION_TIPOS.map((tipo, index) => (
                      <div key={`${row.dia}-${tipo}`} className="flex min-w-0 items-baseline justify-between gap-2">
                        <p className={`truncate text-[12px] ${mutedTextClass}`}>
                          {TIPO_LABELS[tipo]}
                        </p>
                        <p className={`shrink-0 text-[15px] font-semibold ${textClass}`}>
                          {row.values[index]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[15px] border p-4" style={cardStyle}>
            <p className={`text-[14px] font-semibold ${textClass}`}>Historial mensual</p>
            {data.historial_conformidad.length === 0 ? (
              <p className={`mt-2 text-[12px] ${detailTextClass}`}>
                Todavía no hay conformidades registradas.
              </p>
            ) : (
              <div className="mt-3 grid gap-2">
                {data.historial_conformidad.map((item) => (
                  <div
                    key={item.id}
                      className={`rounded-xl border p-3 ${tableBorderClass}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`text-[13px] font-semibold ${textClass}`}>
                        {formatMonthPeriod(item.periodo)}
                      </p>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(
                          item,
                          isDark,
                        )}`}
                      >
                        {item.conforme ? 'Conforme' : 'No conforme'}
                      </span>
                    </div>
                    <p className={`mt-1 text-[12px] ${detailTextClass}`}>
                      {formatDateTime(item.creado)} · {item.usuario_nombre || 'usuario no disponible'}
                    </p>
                    {item.observaciones ? (
                      <p className="mt-1 text-[12px] text-[#C62828]">
                        {item.observaciones}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>
        </>
      ) : null}
    </section>
  )
}
