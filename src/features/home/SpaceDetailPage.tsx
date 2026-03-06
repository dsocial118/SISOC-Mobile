import { useEffect, useState } from 'react'
import type { AxiosError } from 'axios'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getSpaceDetail, type SpaceDetail } from '../../api/spacesApi'
import { CollaboratorsCard } from './CollaboratorsCard'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

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

        const detail =
          (error as AxiosError<{ detail?: string }>)?.response?.data?.detail
          || 'No se pudo cargar la información institucional.'
        setErrorMessage(detail)
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

  function formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Sin dato'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return 'Sin dato'
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
                <span className={`font-semibold ${textClass}`}>Dirección:</span>{' '}
                {displayValue(organizacion?.domicilio)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Teléfono:</span>{' '}
                {displayValue(organizacion?.telefono)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Email:</span>{' '}
                {displayValue(organizacion?.email)}
              </p>
            </div>
          </article>

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '70ms' }}
          >
            <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos del Espacio</h2>

            <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
              <p>
                <span className={`font-semibold ${textClass}`}>Nombre:</span>{' '}
                {displayValue(spaceDetail?.nombre)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Dirección:</span>{' '}
                {formatAddress(spaceDetail)}
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
                <span className={`font-semibold ${textClass}`}>Teléfono:</span> Sin dato
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Email:</span> Sin dato
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
            style={{ ...cardStyle, ['--card-delay' as string]: '140ms' }}
          >
            <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos del Referente del Espacio</h2>

            <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
              <p>
                <span className={`font-semibold ${textClass}`}>Nombre y apellido:</span>{' '}
                {displayValue([referente?.nombre, referente?.apellido].filter(Boolean).join(' ') || null)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>DNI:</span>{' '}
                {displayValue(referente?.documento ? String(referente.documento) : null)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Teléfono:</span>{' '}
                {displayValue(referente?.celular)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Email:</span>{' '}
                {displayValue(referente?.mail)}
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
                <span className={`font-semibold ${textClass}`}>Número de Convenio:</span>{' '}
                {displayValue(spaceDetail?.codigo_de_proyecto)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Fecha de Inicio:</span>{' '}
                {formatDate(spaceDetail?.comienzo)}
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Fecha de Vencimiento:</span> Sin dato
              </p>
              <p>
                <span className={`font-semibold ${textClass}`}>Estado:</span>{' '}
                {displayValue(spaceDetail?.estado)}
              </p>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  )
}
