import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
import { getSpaceDetail, type SpaceDetail } from '../../api/spacesApi'
import { parseApiError } from '../../api/errorUtils'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

export function SpaceRelevamientoDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const [spaceDetail, setSpaceDetail] = useState<SpaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [openSections, setOpenSections] = useState<number[]>([])

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

    async function loadDetail() {
      setPageLoading(true)
      if (!spaceId) {
        setErrorMessage('No se encontró el espacio.')
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
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudo cargar el relevamiento.'))
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
  }, [setPageLoading, spaceId])

  function formatDate(value: string | null | undefined): string {
    if (!value) {
      return 'Sin dato'
    }
    const parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) {
      return value
    }
    return parsedDate.toLocaleDateString('es-AR')
  }

  const relevamiento = spaceDetail?.relevamiento_actual_mobile
  const sections = relevamiento?.sections
    && relevamiento.sections.length > 0
    ? relevamiento.sections
    : relevamiento?.items
      ? [
          {
            titulo: 'Relevamiento',
            items: relevamiento.items,
          },
        ]
      : []

  function toggleSection(index: number) {
    setOpenSections((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index],
    )
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
      <article className="rounded-[15px] border p-5" style={cardStyle}>
        <h2 className={`text-[16px] font-semibold ${textClass}`}>Detalle de Relevamiento</h2>
        <p className={`mt-1 text-xs ${detailTextClass}`}>
          Último relevamiento: {formatDate(relevamiento?.fecha_visita)} · {relevamiento?.estado || 'Sin dato'}
        </p>
      </article>

      {!relevamiento ? (
        <article className="rounded-[15px] border p-5" style={cardStyle}>
          <p className={`text-sm ${detailTextClass}`}>
            No hay relevamientos disponibles para este espacio.
          </p>
        </article>
      ) : (
        sections.map((section, index) => {
          const isOpen = openSections.includes(index)
          return (
            <article key={section.titulo} className="rounded-[15px] border p-4" style={cardStyle}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => toggleSection(index)}
              >
                <h3 className={`text-[15px] font-semibold ${textClass}`}>{section.titulo}</h3>
                <FontAwesomeIcon
                  icon={isOpen ? faChevronUp : faChevronDown}
                  aria-hidden="true"
                  className={isDark ? 'text-white/80' : 'text-slate-600'}
                />
              </button>

              {isOpen ? (
                <div className="mt-3 grid gap-2">
                  {section.items.map((item) => (
                    <div
                      key={`${section.titulo}-${item.pregunta}`}
                      className={`rounded-xl border p-3 ${isDark ? 'border-white/20 bg-white/5' : 'border-[#E0E0E0] bg-white'}`}
                    >
                      <p className={`text-[12px] font-semibold ${textClass}`}>{item.pregunta}</p>
                      <p className={`mt-1 text-sm ${detailTextClass}`}>{item.respuesta}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })
      )}
    </section>
  )
}
