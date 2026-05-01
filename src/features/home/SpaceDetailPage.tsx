import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faChevronRight, faImage, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons'
import {
  deleteSpaceImage,
  getSpaceDetail,
  uploadSpaceImage,
  type SpaceDetail,
  type SpaceImageItem,
} from '../../api/spacesApi'
import { parseApiError } from '../../api/errorUtils'
import { pickFromGallery, takePhoto, type SelectedPhoto } from '../../device/media'
import { AppToast } from '../../ui/AppToast'
import { CollaboratorsCard } from './CollaboratorsCard'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { joinClasses } from '../../ui/buttons'

export function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const [spaceDetail, setSpaceDetail] = useState<SpaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const isCachedDetail = spaceDetail?._source === 'cache'

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
        const detail = await getSpaceDetail(spaceId, { forceRefresh: true })

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
              ...(currentState ? currentState : {}),
              spaceName: nextSpaceName,
              programName: nextProgramName,
            },
          })
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setErrorMessage(
          parseApiError(error, 'No se pudo cargar la información institucional.', {
            timeoutMessage:
              'La carga está demorando más de lo esperado. Deslizá hacia abajo para reintentar.',
          }),
        )
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
  }, [location.pathname, navigate, setPageLoading, spaceId])

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

  function displayNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'Sin dato'
    }
    return new Intl.NumberFormat('es-AR').format(value)
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
  const isAlimentarComunidad =
    (spaceDetail?.programa?.nombre || '').trim().toLowerCase() === 'alimentar comunidad'
  const hasOrganizationData = Boolean(
    organizacion?.nombre
    || organizacion?.cuit
    || organizacion?.telefono
    || organizacion?.email
    || organizacion?.domicilio
    || organizacion?.partido
    || organizacion?.provincia?.nombre
    || organizacion?.municipio?.nombre
    || organizacion?.localidad?.nombre,
  )
  const hasGeo = spaceDetail?.latitud !== null
    && spaceDetail?.latitud !== undefined
    && spaceDetail?.longitud !== null
    && spaceDetail?.longitud !== undefined
  const rawImageItems = (spaceDetail?.imagenes ?? []).filter(
    (item): item is SpaceImageItem => Boolean(item?.url),
  )
  const imageItems = rawImageItems.filter((item) => String(item.origen || '').toLowerCase() === 'mobile')
  const visibleImageCount = Math.min(imageItems.length, 3)
  const canUploadMorePhotos = visibleImageCount < 3

  async function handlePhotoSelection(picker: () => Promise<SelectedPhoto | null>) {
    if (!spaceId || uploadingPhoto || !canUploadMorePhotos) {
      return
    }

    try {
      const selectedPhoto = await picker()
      if (!selectedPhoto) {
        return
      }

      setUploadingPhoto(true)
      const imagenes = await uploadSpaceImage(spaceId, selectedPhoto.file)
      setSpaceDetail((current) => (current ? { ...current, imagenes } : current))
      setToast({
        tone: 'success',
        message: 'La foto del espacio se cargó correctamente.',
      })
    } catch (error) {
      setToast({
        tone: 'error',
        message: parseApiError(error, 'No se pudo cargar la foto del espacio.'),
      })
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleDeleteImage(imageId: number) {
    if (!spaceId || deletingImageId !== null) {
      return
    }
    setDeletingImageId(imageId)
    try {
      const imagenes = await deleteSpaceImage(spaceId, imageId)
      setSpaceDetail((current) => (current ? { ...current, imagenes } : current))
      if (selectedImageUrl) {
        const stillExists = imagenes.some((item) => item.url === selectedImageUrl)
        if (!stillExists) {
          setSelectedImageUrl(null)
        }
      }
      setToast({
        tone: 'success',
        message: 'La foto se eliminó correctamente.',
      })
    } catch (error) {
      setToast({
        tone: 'error',
        message: parseApiError(error, 'No se pudo eliminar la foto.'),
      })
    } finally {
      setDeletingImageId(null)
    }
  }

  return (
    <section>
      <AppToast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />

      {selectedImageUrl ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/90 p-4"
          onClick={() => setSelectedImageUrl(null)}
          role="presentation"
        >
          <button
            type="button"
            aria-label="Cerrar foto"
            className="absolute right-4 top-4 rounded-full bg-white/12 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => setSelectedImageUrl(null)}
          >
            Cerrar
          </button>
          <img
            src={selectedImageUrl}
            alt="Foto del espacio ampliada"
            className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          />
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="mt-4 rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 p-4 text-sm text-white">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage ? (
        <div className="grid gap-4">
          {isCachedDetail ? (
            <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Mostrando datos guardados por conexión lenta.
            </div>
          ) : null}
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

          {hasOrganizationData ? (
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
          ) : null}

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
                <span className={`font-semibold ${textClass}`}>Correo electrónico:</span> Sin dato
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

            {spaceDetail?.datos_convenio_mobile?.tipo === 'pnud' ? (
              <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
                <p><span className={`font-semibold ${textClass}`}>Organización solicitante:</span> {displayValue(spaceDetail.datos_convenio_mobile.organizacion_solicitante || null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Código del proyecto:</span> {displayValue(spaceDetail.datos_convenio_mobile.codigo_proyecto || null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Monto total conveniado:</span> {displayNumber(spaceDetail.datos_convenio_mobile.monto_total_conveniado ?? null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Nro convenio:</span> {displayValue(spaceDetail.datos_convenio_mobile.nro_convenio || null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Estado general:</span> {displayValue(spaceDetail.datos_convenio_mobile.estado_general || null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Subestado:</span> {displayValue(spaceDetail.datos_convenio_mobile.subestado || null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Nombre del espacio comunitario:</span> {displayValue(spaceDetail.datos_convenio_mobile.nombre_espacio_comunitario || null)}</p>
                <p><span className={`font-semibold ${textClass}`}>ID externo:</span> {displayValue(spaceDetail.datos_convenio_mobile.id_externo ? String(spaceDetail.datos_convenio_mobile.id_externo) : null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Domicilio completo del espacio:</span> {displayValue(spaceDetail.datos_convenio_mobile.domicilio_completo_espacio || null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Monto total de convenio por espacio:</span> {displayNumber(spaceDetail.datos_convenio_mobile.monto_total_convenio_por_espacio ?? null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Prestaciones financiadas mensuales:</span> {displayNumber(spaceDetail.datos_convenio_mobile.prestaciones_financiadas_mensuales ?? null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Personas conveniadas:</span> {displayNumber(spaceDetail.datos_convenio_mobile.personas_conveniadas ?? null)}</p>
                <p><span className={`font-semibold ${textClass}`}>Cantidad módulos:</span> {displayNumber(spaceDetail.datos_convenio_mobile.cantidad_modulos ?? null)}</p>
              </div>
            ) : spaceDetail?.datos_convenio_mobile?.tipo === 'alimentar_comunidad' ? (
              <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
                <p>
                  <span className={`font-semibold ${textClass}`}>Vigencia de Convenio:</span>{' '}
                  {spaceDetail.datos_convenio_mobile.vigencia_convenio_meses || 6} meses
                </p>
                <p>
                  <span className={`font-semibold ${textClass}`}>Prestaciones GESCOM:</span>{' '}
                  {displayNumber(spaceDetail.datos_convenio_mobile.prestaciones_gescom_total_mensual ?? null)}
                </p>
                <p>
                  <span className={`font-semibold ${textClass}`}>Monto total del convenio:</span>{' '}
                  {displayNumber(spaceDetail.datos_convenio_mobile.monto_total_convenio ?? null)}
                </p>
              </div>
            ) : (
              <div className={`mt-3 space-y-1.5 text-sm ${detailTextClass}`}>
                <p>Sin datos de convenio para este programa.</p>
              </div>
            )}
          </article>

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '350ms' }}
            role="button"
            tabIndex={0}
            onClick={() =>
              navigate(`/app-org/espacios/${spaceId}/informacion/relevamiento`, {
                state: location.state,
              })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate(`/app-org/espacios/${spaceId}/informacion/relevamiento`, {
                  state: location.state,
                })
              }
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-[16px] font-semibold ${textClass}`}>Datos de Relevamiento</h2>
                {relevamientoActual ? (
                  <p className={`mt-1 text-xs ${detailTextClass}`}>
                    Último relevamiento: {formatDate(relevamientoActual.fecha_visita)} · {displayValue(relevamientoActual.estado)}
                  </p>
                ) : null}
              </div>
              <span
                className={`inline-flex items-center justify-center ${isDark ? 'text-white/85' : 'text-slate-700'}`}
                aria-hidden="true"
              >
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
              </span>
            </div>

            {!relevamientoActual ? (
              <p className={`mt-3 text-sm ${detailTextClass}`}>No hay relevamientos disponibles para este espacio.</p>
            ) : null}
          </article>

          {isAlimentarComunidad ? (
            <article
              className="progressive-card rounded-[15px] border p-5"
              style={{ ...cardStyle, ['--card-delay' as string]: '385ms' }}
              role="button"
              tabIndex={0}
              onClick={() =>
                navigate(`/app-org/espacios/${spaceId}/informacion/capacitaciones`, {
                  state: location.state,
                })
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/app-org/espacios/${spaceId}/informacion/capacitaciones`, {
                    state: location.state,
                  })
                }
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className={`text-[16px] font-semibold ${textClass}`}>Capacitaciones</h2>
                  <p className={`mt-1 text-xs ${detailTextClass}`}>
                    Carga y seguimiento de certificados de capacitaciones.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center justify-center ${isDark ? 'text-white/85' : 'text-slate-700'}`}
                  aria-hidden="true"
                >
                  <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
                </span>
              </div>
            </article>
          ) : null}

          <article
            className="progressive-card rounded-[15px] border p-5"
            style={{ ...cardStyle, ['--card-delay' as string]: '420ms' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className={`text-[16px] font-semibold ${textClass}`}>Fotos del Espacio</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isDark ? 'bg-white/10 text-white/85' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {visibleImageCount}/3 fotos
                </span>
              </div>
            </div>

            {canUploadMorePhotos ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  {
                    key: 'camera',
                    icon: faCamera,
                    title: 'Tomar foto',
                    subtitle: 'Abrir cámara',
                    onClick: () => void handlePhotoSelection(() => takePhoto()),
                  },
                  {
                    key: 'gallery',
                    icon: faImage,
                    title: 'Galería',
                    subtitle: 'Elegir imagen',
                    onClick: () => void handlePhotoSelection(() => pickFromGallery()),
                  },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    disabled={uploadingPhoto}
                    onClick={option.onClick}
                    className={joinClasses(
                      'rounded-2xl border px-4 py-4 text-left transition-all duration-150',
                      isDark
                        ? 'border-white/15 bg-white/8 text-white hover:bg-white/12'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
                      uploadingPhoto
                        ? 'cursor-not-allowed opacity-60'
                        : 'shadow-[0_10px_24px_rgba(15,23,42,0.08)]',
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={joinClasses(
                          'flex h-11 w-11 items-center justify-center rounded-2xl',
                          option.key === 'camera'
                            ? isDark
                              ? 'bg-[#E7BA61]/20 text-[#F3CD82]'
                              : 'bg-[#E7BA61]/20 text-[#9A6A00]'
                            : isDark
                              ? 'bg-[#4FC3F7]/20 text-[#8CDCFB]'
                              : 'bg-[#DFF3FF] text-[#156C8F]',
                        )}
                      >
                        {uploadingPhoto ? (
                          <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                        ) : (
                          <FontAwesomeIcon icon={option.icon} aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`text-sm font-semibold ${textClass}`}>{option.title}</span>
                        <span className={`mt-1 text-xs ${detailTextClass}`}>{option.subtitle}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {imageItems.length === 0 ? (
              <p className={`mt-4 text-sm ${detailTextClass}`}>
                Todavía no hay fotos cargadas desde mobile para este espacio.
              </p>
            ) : (
              <div className="mt-4 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
                {imageItems.slice(0, 3).map((image, index) => (
                  <article
                    key={image.id}
                    className={`relative min-w-[68%] snap-center overflow-hidden rounded-[18px] border ${isDark ? 'border-white/15 bg-white/5' : 'border-slate-200 bg-white'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedImageUrl(image.url ?? null)}
                      className="block w-full text-left transition-transform duration-150 hover:scale-[1.01]"
                    >
                      <img
                        src={image.url ?? ''}
                        alt={`Foto del espacio ${index + 1}`}
                        className="h-[176px] w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    <button
                      type="button"
                      disabled={deletingImageId !== null}
                      onClick={() => void handleDeleteImage(image.id)}
                      className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full ${
                        isDark ? 'bg-[#C62828]/90 text-white' : 'bg-[#C62828] text-white'
                      } ${deletingImageId !== null ? 'cursor-not-allowed opacity-70' : ''}`}
                      aria-label="Eliminar foto"
                    >
                      {deletingImageId === image.id ? (
                        <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                      ) : (
                        <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                      )}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}
    </section>
  )
}



