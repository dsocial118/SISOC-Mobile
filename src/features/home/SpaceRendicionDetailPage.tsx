import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUpRightFromSquare,
  faCamera,
  faImage,
  faFileArrowUp,
  faPaperPlane,
  faPlus,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { type RendicionDetail } from '../../api/rendicionApi'
import { parseApiError } from '../../api/errorUtils'
import {
  deleteRendicionFileOffline,
  deleteRendicionOffline,
  getRendicionDetailOfflineFirst,
  presentRendicionOffline,
  queueRendicionFileUpload,
} from './rendicionOffline'
import { syncNow } from '../../sync/engine'
import { ConfirmActionModal } from '../../ui/ConfirmActionModal'
import { NoticeModal } from '../../ui/NoticeModal'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function statusClasses(status: string, isDark: boolean): string {
  if (status === 'revision') {
    return isDark
      ? 'bg-[#E7BA61]/20 text-[#F7D58D]'
      : 'bg-[#FFF4D6] text-[#8C6A1D]'
  }
  if (status === 'subsanar') {
    return isDark
      ? 'bg-[#C62828]/20 text-[#FFCDD2]'
      : 'bg-[#FDECEC] text-[#C62828]'
  }
  if (status === 'finalizada') {
    return isDark
      ? 'bg-[#2E7D33]/20 text-[#A5D6A7]'
      : 'bg-[#E8F5E9] text-[#2E7D33]'
  }
  return isDark
    ? 'bg-white/10 text-white'
    : 'bg-[#EEF2FF] text-[#232D4F]'
}

type PickerMode = 'camera' | 'gallery' | 'file'

const DOCUMENT_UPLOAD_ACCEPT =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation'

export function SpaceRendicionDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId, rendicionId } = useParams<{ spaceId: string; rendicionId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState = location.state ?? null

  const [loading, setLoading] = useState(true)
  const [loadErrorMessage, setLoadErrorMessage] = useState('')
  const [noticeTitle, setNoticeTitle] = useState('Aviso')
  const [noticeMessage, setNoticeMessage] = useState('')
  const [rendicion, setRendicion] = useState<RendicionDetail | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({})
  const [fileLabels, setFileLabels] = useState<Record<string, string>>({})
  const [extraUploadOpen, setExtraUploadOpen] = useState<Record<string, boolean>>({})
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | string | null>(null)
  const [deletingRendicion, setDeletingRendicion] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [presenting, setPresenting] = useState(false)

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

  function openNotice(message: string, title = 'Revisa la rendicion') {
    setNoticeTitle(title)
    setNoticeMessage(message)
  }

  async function reloadDetail() {
    if (!spaceId || !rendicionId) {
      setLoadErrorMessage('No se encontro la rendicion seleccionada.')
      setLoading(false)
      return
    }
    const detail = await getRendicionDetailOfflineFirst(spaceId, rendicionId)
    setRendicion(detail)
  }

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setPageLoading(true)
      setLoading(true)
      setLoadErrorMessage('')
      try {
        await reloadDetail()
      } catch (error) {
        if (!isMounted) {
          return
        }
        setLoadErrorMessage(parseApiError(error, 'No se pudo cargar la rendicion.'))
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
  }, [rendicionId, setPageLoading, spaceId])

  const canEditFiles = useMemo(
    () => rendicion?.estado === 'elaboracion' || rendicion?.estado === 'subsanar',
    [rendicion?.estado],
  )

  useEffect(() => {
    const syncNotice = rendicion?.last_error?.trim()
    if (!syncNotice) {
      return
    }
    openNotice(syncNotice, 'Aviso de sincronizacion')
  }, [rendicion?.last_error])

  async function handleUpload(categoria: string) {
    if (!spaceId || !rendicionId) {
      return
    }
    const selectedFile = selectedFiles[categoria]
    if (!selectedFile) {
      openNotice('Selecciona un archivo para adjuntar.')
      return
    }
    setUploadingCategory(categoria)
    setNoticeMessage('')
    try {
      const detail = await queueRendicionFileUpload({
        spaceId,
        rendicionId,
        categoria,
        file: selectedFile,
        name: fileLabels[categoria],
      })
      setRendicion(detail)
      setSelectedFiles((current) => ({ ...current, [categoria]: null }))
      setFileLabels((current) => ({ ...current, [categoria]: '' }))
      setExtraUploadOpen((current) => ({ ...current, [categoria]: false }))
      void syncNow()
    } catch (error) {
      openNotice(parseApiError(error, 'No se pudo adjuntar el archivo.'))
    } finally {
      setUploadingCategory(null)
    }
  }

  async function handleDelete(documentoId: number | string) {
    if (!rendicionId) {
      return
    }
    setDeletingDocumentId(documentoId)
    setNoticeMessage('')
    try {
      const detail = await deleteRendicionFileOffline(rendicionId, documentoId)
      setRendicion(detail)
      void syncNow()
    } catch (error) {
      openNotice(parseApiError(error, 'No se pudo eliminar el archivo.'))
    } finally {
      setDeletingDocumentId(null)
    }
  }

  async function handlePresent() {
    if (!spaceId || !rendicionId) {
      return
    }
    setPresenting(true)
    setNoticeMessage('')
    try {
      const detail = await presentRendicionOffline(rendicionId)
      setRendicion(detail)
      void syncNow()
    } catch (error) {
      openNotice(parseApiError(error, 'No se pudo enviar la rendicion a revision.'))
    } finally {
      setPresenting(false)
    }
  }

  async function handleDeleteRendicion() {
    if (!spaceId || !rendicionId || !rendicion) {
      return
    }

    setDeletingRendicion(true)
    setShowDeleteConfirm(false)
    setNoticeMessage('')
    try {
      await deleteRendicionOffline(rendicionId)
      void syncNow()
      navigate(`/app-org/espacios/${spaceId}/rendicion`, {
        replace: true,
        state: routeState,
      })
    } catch (error) {
      openNotice(parseApiError(error, 'No se pudo eliminar la rendicion.'))
      setDeletingRendicion(false)
    }
  }

  function buildInputProps(mode: PickerMode) {
    if (mode === 'camera') {
      return {
        accept: 'image/*',
        capture: 'environment' as const,
      }
    }
    if (mode === 'gallery') {
      return {
        accept: 'image/*',
      }
    }
    return {
      accept: DOCUMENT_UPLOAD_ACCEPT,
    }
  }

  if (loading) {
    return null
  }

  if (loadErrorMessage && !rendicion) {
    return (
      <section>
        <div className="mt-4 rounded-xl border border-[#C62828]/20 bg-[#C62828]/10 p-4 text-sm text-[#C62828]">
          {loadErrorMessage}
        </div>
      </section>
    )
  }

  if (!rendicion) {
    return null
  }

  return (
    <section className="grid gap-3">
      <div>
        <h2 className={`text-[16px] font-semibold ${titleClass}`}>
          Rendicion {rendicion.numero_rendicion ?? rendicion.id}
        </h2>
        <p className={`mt-1 text-sm ${subtitleClass}`}>
          Seguimiento de documentacion y estado de revision.
        </p>
      </div>

      <article className="rounded-xl border p-4" style={cardStyle}>
        <div className="grid gap-2">
          <p className={`text-[15px] font-semibold ${titleClass}`}>
            Convenio {rendicion.convenio || 'Sin dato'}
          </p>
          <p
            className={`inline-flex w-fit rounded-full px-2 py-1 text-[11px] font-semibold ${statusClasses(rendicion.estado, isDark)}`}
          >
            {rendicion.estado_label}
          </p>
          <p className={`text-[12px] ${subtitleClass}`}>Periodo: {rendicion.periodo_label}</p>
          <p className={`text-[12px] ${subtitleClass}`}>
            Creada el {formatDateTime(rendicion.fecha_creacion)}
          </p>
          {rendicion.observaciones ? (
            <p className={`text-[12px] ${subtitleClass}`}>{rendicion.observaciones}</p>
          ) : null}
        </div>
      </article>

      <section className="grid gap-3">
        {rendicion.documentacion.map((categoria) => {
          const alreadyHasSingleFile = !categoria.multiple && categoria.archivos.length > 0
          const canUploadInCategory = canEditFiles && !alreadyHasSingleFile
          const isExtraCategory = categoria.codigo === 'otros'
          const showUploader =
            canUploadInCategory && (!isExtraCategory || extraUploadOpen[categoria.codigo])
          const selectedFile = selectedFiles[categoria.codigo]
          const currentLabel = fileLabels[categoria.codigo] || ''

          return (
            <article key={categoria.codigo} className="rounded-xl border p-4" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-[14px] font-semibold ${titleClass}`}>{categoria.label}</p>
                  <p className={`mt-1 text-[12px] ${subtitleClass}`}>
                    {categoria.required ? 'Obligatorio' : 'Opcional'} ·{' '}
                    {categoria.multiple ? 'Multiples archivos' : 'Un unico archivo'}
                  </p>
                </div>
                <span className={`text-[12px] font-semibold ${subtitleClass}`}>
                  {categoria.archivos.length} archivo(s)
                </span>
              </div>

              {categoria.archivos.length === 0 ? (
                <p className={`mt-3 text-[12px] ${subtitleClass}`}>Sin archivos cargados.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {categoria.archivos.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 ${
                        isDark ? 'border-white/20 bg-white/10' : 'border-slate-300 bg-white/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-[13px] font-semibold ${titleClass}`}>
                            {item.nombre}
                          </p>
                          <p className={`mt-1 text-[12px] ${subtitleClass}`}>
                            {item.estado_label} · {formatDateTime(item.fecha_creacion)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer">
                              <FontAwesomeIcon
                                icon={faArrowUpRightFromSquare}
                                aria-hidden="true"
                                className={`${subtitleClass}`}
                              />
                            </a>
                          ) : null}
                          {canEditFiles ? (
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                              className="text-[#C62828]"
                              disabled={deletingDocumentId === item.id}
                              aria-label={`Eliminar ${item.nombre}`}
                            >
                              <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canUploadInCategory && isExtraCategory && !extraUploadOpen[categoria.codigo] ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setExtraUploadOpen((current) => ({
                        ...current,
                        [categoria.codigo]: true,
                      }))
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#232D4F] px-4 py-3 text-sm font-semibold text-white"
                  >
                    <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                    Anadir documentacion extra
                  </button>
                </div>
              ) : null}

              {showUploader ? (
                <div className="mt-4 grid gap-3">
                  {isExtraCategory ? (
                    <label className="grid gap-1">
                      <span className={`text-[12px] font-semibold ${titleClass}`}>
                        Nombre del archivo
                      </span>
                      <input
                        value={currentLabel}
                        onChange={(event) =>
                          setFileLabels((current) => ({
                            ...current,
                            [categoria.codigo]: event.target.value,
                          }))
                        }
                        className={`rounded-xl border px-3 py-3 text-sm outline-none ${inputClass}`}
                        placeholder="Opcional"
                      />
                    </label>
                  ) : null}

                  <div className="grid gap-2">
                    <p className={`text-[12px] font-semibold ${titleClass}`}>Como cargar</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          mode: 'camera' as const,
                          icon: faCamera,
                          label: 'Sacar foto',
                        },
                        {
                          mode: 'gallery' as const,
                          icon: faImage,
                          label: 'Imagen de galeria',
                        },
                        {
                          mode: 'file' as const,
                          icon: faFileArrowUp,
                          label: 'Subir archivo',
                        },
                      ].map((option) => {
                        const inputProps = buildInputProps(option.mode)
                        return (
                          <label
                            key={`${categoria.codigo}-${option.mode}`}
                            className={`cursor-pointer rounded-xl border px-2 py-2 text-center ${
                              isDark
                                ? 'border-white/20 bg-white/10 text-white'
                                : 'border-slate-300 bg-white text-slate-700'
                            }`}
                          >
                            <input
                              type="file"
                              accept={inputProps.accept}
                              capture={inputProps.capture}
                              className="hidden"
                              onChange={(event) =>
                                setSelectedFiles((current) => ({
                                  ...current,
                                  [categoria.codigo]: event.target.files?.[0] || null,
                                }))
                              }
                            />
                            <span className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold leading-tight sm:text-xs">
                              <FontAwesomeIcon icon={option.icon} aria-hidden="true" />
                              {option.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {selectedFile ? (
                    <div
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        isDark
                          ? 'border-white/20 bg-white/10 text-white'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      Archivo seleccionado: <strong>{selectedFile.name}</strong>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={uploadingCategory === categoria.codigo || !selectedFile}
                    onClick={() => void handleUpload(categoria.codigo)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#232D4F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <FontAwesomeIcon icon={faFileArrowUp} aria-hidden="true" />
                    {uploadingCategory === categoria.codigo
                      ? 'Adjuntando...'
                      : isExtraCategory
                        ? 'Adjuntar documentacion extra'
                        : 'Adjuntar archivo'}
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>

      {!canEditFiles ? (
        <div
          className={`rounded-xl border p-4 text-sm ${
            isDark
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          Esta rendicion ya no admite cambios en esta etapa.
        </div>
      ) : null}

      {canEditFiles ? (
        <div className="grid grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deletingRendicion}
            className="col-span-1 inline-flex items-center justify-center rounded-xl bg-[#C62828] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            aria-label={deletingRendicion ? 'Eliminando rendicion' : 'Borrar rendicion'}
          >
            <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => void handlePresent()}
            disabled={presenting}
            className="col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D33] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faPaperPlane} aria-hidden="true" />
            {presenting ? 'Enviando...' : 'Enviar a revision'}
          </button>
        </div>
      ) : null}

      <ConfirmActionModal
        open={showDeleteConfirm}
        title="¿Borrar rendicion?"
        message={`Se va a borrar la rendicion ${rendicion.numero_rendicion ?? rendicion.id}. Esta accion no se puede deshacer.`}
        confirmLabel="Confirmar"
        loading={deletingRendicion}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => void handleDeleteRendicion()}
      />
      <NoticeModal
        open={Boolean(noticeMessage)}
        title={noticeTitle}
        message={noticeMessage}
        onClose={() => setNoticeMessage('')}
      />
    </section>
  )
}
