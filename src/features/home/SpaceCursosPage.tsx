import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronRight,
  faGraduationCap,
} from '@fortawesome/free-solid-svg-icons'
import { useParams } from 'react-router-dom'
import { listFormacionCursos, type FormacionCursoItem } from '../../api/formacionApi'
import { parseApiError } from '../../api/errorUtils'
import { AppLoadingSpinner } from '../../ui/AppLoadingSpinner'
import { useAppTheme } from '../../ui/ThemeContext'

function FormacionSkeleton({ isDark }: { isDark: boolean }) {
  const cardClass = isDark ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-white'
  const lineClass = isDark ? 'bg-white/20' : 'bg-slate-200'
  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'

  return (
    <section className="space-y-4">
      <div className="grid gap-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`rounded-[15px] border p-4 pr-12 ${cardClass} animate-pulse`}
          >
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${lineClass}`} />
              <div className={`h-4 w-52 rounded ${lineClass}`} />
            </div>
          </div>
        ))}
      </div>
      <div className={`pt-0.5 text-center ${textClass}`}>
        <div className="flex justify-center">
          <AppLoadingSpinner size={42} />
        </div>
        <p className="mt-1 text-[13px] font-semibold">Cargando tu información</p>
      </div>
    </section>
  )
}

export function SpaceCursosPage() {
  const { spaceId } = useParams<{ spaceId: string }>()
  const { isDark } = useAppTheme()
  const [rows, setRows] = useState<FormacionCursoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadRows() {
      if (!spaceId) {
        setRows([])
        setLoading(false)
        return
      }
      setLoading(true)
      setErrorMessage('')
      try {
        const response = await listFormacionCursos(spaceId)
        if (!isMounted) {
          return
        }
        setRows(response)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setErrorMessage(parseApiError(error, 'No se pudieron cargar los cursos de formación.'))
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadRows()
    return () => {
      isMounted = false
    }
  }, [spaceId])

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
  const titleClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const subtitleClass = isDark ? 'text-white/80' : 'text-slate-600'
  const detailTextClass = isDark ? 'text-white/85' : 'text-slate-700'
  const dividerClass = isDark ? 'border-white/20' : 'border-slate-300'
  const introTextClass = isDark ? 'text-white/90' : 'text-slate-700'

  if (loading) {
    return <FormacionSkeleton isDark={isDark} />
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

  if (rows.length === 0) {
    return (
      <section className="grid gap-3">
        <article className="rounded-[15px] border p-4" style={cardStyle}>
          <p className={`text-[14px] ${detailTextClass}`}>
            No hay cursos disponibles para este espacio.
          </p>
        </article>
      </section>
    )
  }

  const cursosComunes = rows.filter((item) => !item.es_recomendado)
  const cursosRecomendados = rows.filter((item) => item.es_recomendado)

  return (
    <section className="grid gap-3">
      <p className={`mb-2 text-[15px] leading-[1.35] ${introTextClass}`}>
        En esta sección encontrarás accesos directos a cursos y recursos de la plataforma Formando
        Capital Humano.
      </p>
      {cursosComunes.map((section, index) => (
        <a
          key={section.id}
          href={section.link}
          target="_blank"
          rel="noreferrer"
          className="progressive-card relative rounded-[15px] border p-4 pr-12 text-left"
          style={{
            ...cardStyle,
            ['--card-delay' as string]: `${index * 70}ms`,
          }}
        >
          <div className="flex items-center gap-3">
            {section.imagen_url ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <img
                  src={section.imagen_url}
                  alt={section.nombre}
                  className="block h-full w-full object-contain"
                />
              </span>
            ) : (
              <span className={`flex h-8 w-8 items-center justify-center ${subtitleClass}`}>
                <FontAwesomeIcon icon={faGraduationCap} aria-hidden="true" style={{ fontSize: 22 }} />
              </span>
            )}
            <div className="min-w-0">
              <p className={`text-[16px] font-medium ${titleClass}`}>{section.nombre}</p>
            </div>
          </div>
          <span
            className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center ${subtitleClass}`}
          >
            <FontAwesomeIcon
              icon={faChevronRight}
              aria-hidden="true"
              style={{ fontSize: 18 }}
            />
          </span>
        </a>
      ))}
      {cursosRecomendados.length > 0 ? (
        <>
          <hr className={`my-3 border-t ${dividerClass}`} />
          <h2 className={`mb-1 text-[18px] font-semibold ${titleClass}`}>Cursos recomendados</h2>
          {cursosRecomendados.map((section, index) => (
            <a
              key={section.id}
              href={section.link}
              target="_blank"
              rel="noreferrer"
              className="progressive-card relative rounded-[15px] border p-4 pr-12 text-left"
              style={{
                ...cardStyle,
                ['--card-delay' as string]: `${(cursosComunes.length + index) * 70}ms`,
              }}
            >
              <div className="flex items-center gap-3">
                {section.imagen_url ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                    <img
                      src={section.imagen_url}
                      alt={section.nombre}
                      className="block h-full w-full object-contain"
                    />
                  </span>
                ) : (
                  <span className={`flex h-8 w-8 items-center justify-center ${subtitleClass}`}>
                    <FontAwesomeIcon
                      icon={faGraduationCap}
                      aria-hidden="true"
                      style={{ fontSize: 22 }}
                    />
                  </span>
                )}
                <div className="min-w-0">
                  <p className={`text-[16px] font-medium ${titleClass}`}>{section.nombre}</p>
                </div>
              </div>
              <span
                className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center ${subtitleClass}`}
              >
                <FontAwesomeIcon
                  icon={faChevronRight}
                  aria-hidden="true"
                  style={{ fontSize: 18 }}
                />
              </span>
            </a>
          ))}
        </>
      ) : null}
    </section>
  )
}
