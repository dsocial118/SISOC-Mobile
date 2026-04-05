import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getSpaceDetail, type SpaceDetail } from '../../api/spacesApi'
import { parseApiError } from '../../api/errorUtils'
import { CollaboratorsCard } from './CollaboratorsCard'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/theme'

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const [spaceDetail, setSpaceDetail] = useState<SpaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadDetail() {
      setPageLoading(true)
      if (!spaceId) {
        setErrorMessage('No se encontro el espacio.')
        setLoading(false)
        setPageLoading(false)
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {
        const detail = await getSpaceDetail(spaceId)

        if (!isMounted) {
          return
        }

        setSpaceDetail(detail)

        const currentState = (location.state as { spaceName?: string; programName?: string } | null) ?? null
        const nextSpaceName = detail.nombre || 'Espacio'
        const nextProgramName = detail.programa?.nombre || ''

        if (currentState?.spaceName !== nextSpaceName || currentState?.programName !== nextProgramName) {
          navigate(location.pathname, {
            replace: true,
            state: {
              ...(currentState ?? {}),
              spaceName: nextSpaceName,
              programName: nextProgramName,
            },
          })
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setErrorMessage(parseApiError(error, 'No se pudo cargar la información institucional.'))
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadDetail()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [location.pathname, location.state, navigate, setPageLoading, spaceId])

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

  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const detailTextClass = isDark ? 'text-white/90' : 'text-slate-700'
  const subCardClass = isDark ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white/80'

  function displayValue(value: string | null | undefined): string {
    if (!value) {
      return 'Sin dato'
    }
    return value
  }

  function formatDate(value: string | number | null | undefined): string {
    if (!value) {
      return 'Sin dato'
    }
    if (typeof value === 'number') {
      return String(value)
    }
    if (/^\d{4}$/.test(value)) {
      return value
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return String(value)
    }
    return date.toLocaleDateString('es-AR')
  }

  function formatAddress(detail: SpaceDetail | null): string {
    if (!detail) {
      return 'Sin dato'
    }
    const chunks = [
      detail.calle ? `${detail.calle}${detail.numero ? ` ${detail.numero}` : ''}` : '',
      detail.piso ? `Piso ${detail.piso}` : '',
      detail.departamento ? `Depto ${detail.departamento}` : '',
      detail.manzana ? `Mz ${detail.manzana}` : '',
      detail.lote ? `Lote ${detail.lote}` : '',
      detail.barrio ? `Barrio ${detail.barrio}` : '',
      detail.partido ? `Partido ${detail.partido}` : '',
      detail.codigo_postal ? `CP ${detail.codigo_postal}` : '',
    ].filter(Boolean)
    return chunks.length > 0 ? chunks.join(', ') : 'Sin dato'
  }

  const organizacion = spaceDetail?.organizacion
  const referente = spaceDetail?.referente
  const relevamientoActual = spaceDetail?.relevamiento_actual_mobile
  const hasGeo = spaceDetail?.latitud !== null
    && spaceDetail?.latitud !== undefined
    && spaceDetail?.longitud !== null
    && spaceDetail?.longitud !== undefined

  return (
    <section>
      {!loading && errorMessage ? (
        <div className="mt-4 rounded-xl border border-[#C62828]/20 bg-[#C62828]/10 p-4 text-sm text-[#C62828]">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage ? (
        <div className="grid gap-4">
          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '0ms' }}
          >
            <p className={`text-[12px] font-semibold uppercase tracking-[0.18em] ${detailTextClass}`}>
              Información Institucional
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${detailTextClass}`}>
                  Espacio
                </p>
                <p className={`mt-1 text-[16px] font-semibold ${textClass}`}>
                  {displayValue(spaceDetail?.nombre)}
                </p>
              </div>
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${detailTextClass}`}>
                  Organización
                </p>
                <p className={`mt-1 text-[16px] font-semibold ${textClass}`}>
                  {displayValue(organizacion?.nombre)}
                </p>
              </div>
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${detailTextClass}`}>
                  Programa
                </p>
                <p className={`mt-1 text-[16px] font-semibold ${textClass}`}>
                  {displayValue(spaceDetail?.programa?.nombre)}
                </p>
              </div>
            </div>
          </article>

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '70ms' }}
          >
            <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos de la Organización</h2>

            <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
              <p>
                <span className={`font-semibold ${textClass}`}>Nombre:</span>{' '}
                {displayValue(organizacion?.nombre)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>CUIT:</span>{' '}
                {displayValue(organizacion?.cuit)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Mail:</span>{' '}
                {displayValue(organizacion?.email)}
              </p>
            </div>
          </article>

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '140ms' }}
          >
            <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos del Espacio</h2>

            <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
              <p>
                <span className={`font-semibold ${textClass}`}>Estado actividad:</span>{' '}
                {displayValue(spaceDetail?.ultimo_estado?.estado_actividad)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Estado proceso:</span>{' '}
                {displayValue(spaceDetail?.ultimo_estado?.estado_proceso)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Calle:</span>{' '}
                {displayValue(spaceDetail?.calle)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Número:</span>{' '}
                {spaceDetail?.numero ? String(spaceDetail.numero) : 'Sin dato'}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Provincia:</span>{' '}
                {displayValue(spaceDetail?.provincia?.nombre)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Localidad:</span>{' '}
                {displayValue(spaceDetail?.localidad?.nombre)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Domicilio:</span>{' '}
                {formatAddress(spaceDetail)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Domicilio electrónico:</span> Sin dato
              </p>
            </div>

            {hasGeo ? (
              <div className="mt-4">
                <div className="overflow-hidden rounded-[12px] border border-[#E0E0E0]">
                  <iframe
                    title="Mapa del espacio"
                    src={`https://maps.google.com/maps?q=${spaceDetail?.latitud},${spaceDetail?.longitud}&z=15&output=embed`}
                    className="h-[180px] w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${spaceDetail?.latitud},${spaceDetail?.longitud}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`mt-2 inline-block text-xs font-semibold ${isDark ? 'text-[#E7BA61]' : 'text-[#232D4F]'}`}
                >
                  Abrir ubicación en mapa
                </a>
              </div>
            ) : (
              <p className={`mt-4 text-xs ${detailTextClass}`}>Mapa: Sin geolocalización disponible.</p>
            )}
          </article>

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '210ms' }}
          >
            <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos del Referente del Espacio</h2>

            <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
              <p>
                <span className={`font-semibold ${textClass}`}>Nombre:</span>{' '}
                {displayValue(referente?.nombre)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Apellido:</span>{' '}
                {displayValue(referente?.apellido)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>DNI:</span>{' '}
                {displayValue(referente?.documento ? String(referente.documento) : null)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Mail:</span>{' '}
                {displayValue(referente?.mail)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Celular:</span>{' '}
                {displayValue(referente?.celular ? String(referente.celular) : null)}
              </p>
            </div>
          </article>

          {spaceId ? (
            <CollaboratorsCard
              spaceId={spaceId}
              isDark={isDark}
              cardStyle={cardStyle}
              textClass={textClass}
              detailTextClass={detailTextClass}
              subCardClass={subCardClass}
            />
          ) : null}

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '280ms' }}
          >
            <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos de Convenio</h2>

            <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
              <p>
                <span className={`font-semibold ${textClass}`}>Fecha de Inicio de Convenio:</span> Sin dato
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Vigencia de Convenio:</span> 12 meses
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Prestaciones GESCOM:</span>{' '}
                {displayValue(spaceDetail?.codigo_de_proyecto)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Monto total del convenio:</span> Sin dato
              </p>
            </div>
          </article>

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '350ms' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos de Relevamiento</h2>
                {relevamientoActual ? (
                  <p className={`mt-1 text-xs ${detailTextClass}`}>
                    Último relevamiento: {formatDate(relevamientoActual.fecha_visita)} · {displayValue(relevamientoActual.estado)}
                  </p>
                ) : null}
              </div>
            </div>

            {!relevamientoActual ? (
              <p className={`mt-3 text-sm ${detailTextClass}`}>No hay relevamientos disponibles para este espacio.</p>
            ) : (
              <div className="mt-3 grid gap-3">
                {relevamientoActual.items.map((item) => (
                  <div
                    key={item.pregunta}
                    className={`rounded-xl border p-3 ${subCardClass}`}
                  >
                    <p className={`text-[12px] font-semibold ${textClass}`}>{item.pregunta}</p>
                    <p className={`mt-1 text-sm ${detailTextClass}`}>{item.respuesta}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}
    </section>
  )
}
