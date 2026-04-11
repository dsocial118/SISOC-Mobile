import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCamera,
  faFileArrowUp,
  faFilePdf,
  faImage,
  faSpinner,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useParams } from 'react-router-dom'
import {
  deleteSpaceCapacitacionCertificado,
  listSpaceCapacitaciones,
  uploadSpaceCapacitacionCertificado,
  type CapacitacionCertificadoItem,
} from '../../api/capacitacionesApi'
import { parseApiError } from '../../api/errorUtils'
import { getSpaceDetail } from '../../api/spacesApi'
import { pickFromGallery, takePhoto } from '../../device/media'
import { AppToast } from '../../ui/AppToast'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { appButtonClass, joinClasses } from '../../ui/buttons'

const CERTIFICATE_ACCEPT = 'image/*,.pdf,application/pdf'

function isImageFile(item: CapacitacionCertificadoItem): boolean {
  const name = (item.archivo_nombre || item.archivo_url || '').toLowerCase()
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(name)
}

function isPdfFile(item: CapacitacionCertificadoItem): boolean {
  const name = (item.archivo_nombre || item.archivo_url || '').toLowerCase()
  return /\.pdf$/i.test(name)
}

function statusPillClass(status: string, isDark: boolean): string {
  if (status === 'aceptado') {
    return isDark ? 'bg-[#2E7D33]/25 text-[#A5D6A7]' : 'bg-[#E8F5E9] text-[#2E7D33]'
  }
  if (status === 'rechazado') {
    return isDark ? 'bg-[#C62828]/25 text-[#FFCDD2]' : 'bg-[#FDECEC] text-[#C62828]'
  }
  return isDark ? 'bg-[#E7BA61]/25 text-[#F7D58D]' : 'bg-[#FFF4D6] text-[#8C6A1D]'
}

export function SpaceCapacitacionesPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const location = useLocation()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState =
    (location.state as { spaceName?: string; programName?: string } | null) ?? null

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [items, setItems] = useState<CapacitacionCertificadoItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File | null>>({})
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  )

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

    async function loadData() {
      setPageLoading(true)
      setLoading(true)
      setErrorMessage('')
      if (!spaceId) {
        setErrorMessage('No se encontro el espacio.')
        setLoading(false)
        setPageLoading(false)
        return
      }
      try {
        let isAlimentarComunidad =
          (routeState?.programName || '').trim().toLowerCase() === 'alimentar comunidad'
        if (!isAlimentarComunidad) {
          const detail = await getSpaceDetail(spaceId)
          isAlimentarComunidad =
            (detail.programa?.nombre || '').trim().toLowerCase() === 'alimentar comunidad'
        }
        if (!isAlimentarComunidad) {
          if (!isMounted) {
            return
          }
          setEnabled(false)
          setItems([])
          return
        }
        setEnabled(true)
        const rows = await listSpaceCapacitaciones(spaceId)
        if (!isMounted) {
          return
        }
        setItems(rows)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudieron cargar las capacitaciones.'))
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

  function pickCertificateFile(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = CERTIFICATE_ACCEPT
      input.onchange = () => {
        resolve(input.files?.[0] ?? null)
      }
      input.click()
    })
  }

  async function handlePhotoSelection(itemId: number, picker: typeof takePhoto) {
    if (uploadingId !== null || deletingId !== null) {
      return
    }
    try {
      const selectedPhoto = await picker()
      if (!selectedPhoto) {
        return
      }
      setSelectedFiles((current) => ({
        ...current,
        [itemId]: selectedPhoto.file,
      }))
    } catch (error) {
      setToast({
        tone: 'error',
        message: parseApiError(error, 'No se pudo seleccionar la imagen.'),
      })
    }
  }

  async function handleFileSelection(itemId: number) {
    if (uploadingId !== null || deletingId !== null) {
      return
    }
    const file = await pickCertificateFile()
    if (!file) {
      return
    }
    setSelectedFiles((current) => ({
      ...current,
      [itemId]: file,
    }))
  }

  async function handleUpload(item: CapacitacionCertificadoItem) {
    if (!spaceId || uploadingId !== null || deletingId !== null) {
      return
    }
    const file = selectedFiles[item.id]
    if (!file) {
      setToast({ tone: 'error', message: 'Selecciona un archivo antes de subir.' })
      return
    }
    setUploadingId(item.id)
    try {
      const updated = await uploadSpaceCapacitacionCertificado(spaceId, item.capacitacion, file)
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      setSelectedFiles((current) => ({ ...current, [item.id]: null }))
      setToast({ tone: 'success', message: 'Certificado cargado correctamente.' })
    } catch (error) {
      setToast({
        tone: 'error',
        message: parseApiError(error, 'No se pudo subir el certificado.'),
      })
    } finally {
      setUploadingId(null)
    }
  }

  async function handleDelete(item: CapacitacionCertificadoItem) {
    if (!spaceId || deletingId !== null || uploadingId !== null) {
      return
    }
    setDeletingId(item.id)
    try {
      const updated = await deleteSpaceCapacitacionCertificado(spaceId, item.capacitacion)
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      setSelectedFiles((current) => ({ ...current, [item.id]: null }))
      setToast({ tone: 'success', message: 'Certificado eliminado correctamente.' })
    } catch (error) {
      setToast({
        tone: 'error',
        message: parseApiError(error, 'No se pudo eliminar el certificado.'),
      })
    } finally {
      setDeletingId(null)
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
    <section className="grid gap-3 pb-24">
      <AppToast
        open={Boolean(toast)}
        message={toast?.message ?? ''}
        tone={toast?.tone ?? 'success'}
        onClose={() => setToast(null)}
      />

      <article className="rounded-[15px] border p-5" style={cardStyle}>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Capacitaciones</h2>
        <p className={`mt-1 text-xs ${detailTextClass}`}>
          {routeState?.spaceName ? `${routeState.spaceName} · ` : ''}
          Carga de certificados por capacitacion.
        </p>
      </article>

      {!enabled ? (
        <article className="rounded-[15px] border p-5" style={cardStyle}>
          <p className={`text-sm ${detailTextClass}`}>
            Esta seccion aplica solo a espacios del programa Alimentar Comunidad.
          </p>
        </article>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const selectedFile = selectedFiles[item.id]
            const isUploading = uploadingId === item.id
            const isDeleting = deletingId === item.id
            const hasCertificate = Boolean(item.archivo_url || item.archivo_nombre)
            const canDelete = hasCertificate && item.estado !== 'aceptado'
            const canUpload = !hasCertificate

            return (
              <article key={item.id} className="rounded-[15px] border p-4" style={cardStyle}>
                <div>
                  <h3 className={`text-[14px] font-semibold ${textClass}`}>{item.capacitacion_label}</h3>
                  <div className="mt-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusPillClass(
                        item.estado,
                        isDark,
                      )}`}
                    >
                      {item.estado_label}
                    </span>
                  </div>
                </div>

                {hasCertificate ? (
                  <div
                    className={`mt-3 flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border ${
                      isDark ? 'border-white/20 bg-white/5' : 'border-slate-200 bg-white'
                    }`}
                  >
                    {item.archivo_url && isImageFile(item) ? (
                      <img
                        src={item.archivo_url}
                        alt="Miniatura certificado"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <FontAwesomeIcon
                        icon={isPdfFile(item) ? faFilePdf : faFileArrowUp}
                        aria-hidden="true"
                        className={isPdfFile(item) ? 'text-[#C62828]' : detailTextClass}
                        style={{ fontSize: 44 }}
                      />
                    )}
                  </div>
                ) : null}

                {item.observacion ? (
                  <p className="mt-2 text-[12px] text-[#C62828]">Observacion: {item.observacion}</p>
                ) : null}

                {canUpload ? (
                  <>
                    <div className={`mt-3 grid gap-2 text-[12px] ${detailTextClass}`}>
                      <p className={`text-[12px] font-semibold ${textClass}`}>Como cargar</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          {
                            key: 'camera',
                            icon: faCamera,
                            title: 'Foto',
                            onClick: () => void handlePhotoSelection(item.id, takePhoto),
                          },
                          {
                            key: 'gallery',
                            icon: faImage,
                            title: 'Galeria',
                            onClick: () => void handlePhotoSelection(item.id, pickFromGallery),
                          },
                          {
                            key: 'file',
                            icon: faFileArrowUp,
                            title: 'Archivo',
                            onClick: () => void handleFileSelection(item.id),
                          },
                        ].map((option) => (
                          <button
                            key={`${item.id}-${option.key}`}
                            type="button"
                            disabled={uploadingId !== null || deletingId !== null}
                            onClick={option.onClick}
                            className={joinClasses(
                              'rounded-xl border px-2 py-2 text-center transition-all duration-150',
                              isDark
                                ? 'border-white/15 bg-white/8 text-white hover:bg-white/12'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
                              uploadingId !== null || deletingId !== null
                                ? 'cursor-not-allowed opacity-60'
                                : undefined,
                            )}
                          >
                            <span className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold leading-tight sm:text-xs">
                              <FontAwesomeIcon icon={option.icon} aria-hidden="true" />
                              {option.title}
                            </span>
                          </button>
                        ))}
                      </div>

                      <p className={`text-[12px] ${detailTextClass}`}>
                        Archivo seleccionado:{' '}
                        <span className="font-semibold">{selectedFile ? selectedFile.name : 'Ninguno'}</span>
                      </p>
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={isUploading || isDeleting}
                        onClick={() => void handleUpload(item)}
                        className={joinClasses(
                          appButtonClass({ variant: 'success', size: 'lg', fullWidth: true }),
                          isUploading || isDeleting ? 'cursor-not-allowed opacity-60' : undefined,
                        )}
                      >
                        {isUploading ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                            Subiendo...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faFileArrowUp} aria-hidden="true" />
                            Subir certificado
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : null}

                {canDelete ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={isUploading || isDeleting}
                      onClick={() => void handleDelete(item)}
                      className={joinClasses(
                        appButtonClass({ variant: 'danger', size: 'lg', fullWidth: true }),
                        isUploading || isDeleting ? 'cursor-not-allowed opacity-60' : undefined,
                      )}
                    >
                      {isDeleting ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                          Borrar certificado
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

