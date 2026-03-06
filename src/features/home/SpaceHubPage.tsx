import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import {
  faCalculator,
  faCalendarDays,
  faComments,
  faCircleInfo,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { listMySpaces } from '../../api/spacesApi'
import { getSpaceDetail, type SpaceDetail } from '../../api/spacesApi'
import { useAuth } from '../../auth/useAuth'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

interface HubModule {
  id: string
  title: string
  route: string
  icon: IconDefinition
}

export function SpaceHubPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { spaceId } = useParams<{ spaceId: string }>()
  const { userProfile } = useAuth()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const routeState = (location.state as {
    spaceName?: string
    programName?: string
    fromSingleSpaceAuto?: boolean
  } | null) ?? null
  const hasFastContext = Boolean(routeState?.spaceName)
  const [spaceDetail, setSpaceDetail] = useState<SpaceDetail | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(!hasFastContext)
  const [isSingleSpaceUser, setIsSingleSpaceUser] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadSpace() {
      const shouldBlockUi = !hasFastContext
      setPageLoading(shouldBlockUi)
      if (!spaceId) {
        setErrorMessage('No se encontro el espacio seleccionado.')
        setLoading(false)
        setPageLoading(false)
        return
      }

      if (shouldBlockUi) {
        setLoading(true)
      }
      setErrorMessage('')
      try {
        const detail = await getSpaceDetail(spaceId)
        if (!isMounted) {
          return
        }
        setSpaceDetail(detail)
        const nextSpaceName = detail.nombre || 'Espacio'
        const nextProgramName = detail.programa?.nombre || ''
        if (
          routeState?.spaceName !== nextSpaceName
          || routeState?.programName !== nextProgramName
        ) {
          navigate(location.pathname, {
            replace: true,
            state: {
              ...routeState,
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
          || 'No se pudo validar el espacio.'
        if (shouldBlockUi) {
          setErrorMessage(detail)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadSpace()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [hasFastContext, setPageLoading, spaceId])

  useEffect(() => {
    let isMounted = true

    async function resolveSingleSpaceMode() {
      const cacheKey = (userProfile?.username || '__anonymous__').trim() || '__anonymous__'
      const cached = getOrganizationSpacesCache(cacheKey)
      if (cached) {
        if (isMounted) {
          setIsSingleSpaceUser(cached.length === 1)
        }
        return
      }

      try {
        const spaces = await listMySpaces()
        setOrganizationSpacesCache(cacheKey, spaces)
        if (isMounted) {
          setIsSingleSpaceUser(spaces.length === 1)
        }
      } catch {
        if (isMounted) {
          setIsSingleSpaceUser(false)
        }
      }
    }

    void resolveSingleSpaceMode()
    return () => {
      isMounted = false
    }
  }, [userProfile?.username])

  const modules = useMemo<HubModule[]>(() => {
    if (!spaceId) {
      return []
    }
    return [
      {
        id: 'info',
        title: 'Información Institucional',
        route: `/app-org/espacios/${spaceId}/informacion`,
        icon: faCircleInfo,
      },
      {
        id: 'mensajes',
        title: 'Mensajes',
        route: `/app-org/espacios/${spaceId}/mensajes`,
        icon: faComments,
      },
      {
        id: 'actividades',
        title: 'Actividades',
        route: `/app-org/espacios/${spaceId}/actividades`,
        icon: faCalendarDays,
      },
      {
        id: 'nomina',
        title: 'Nómina',
        route: `/app-org/espacios/${spaceId}/nomina`,
        icon: faUsers,
      },
      {
        id: 'rendicion',
        title: 'Rendición de Cuentas',
        route: `/app-org/espacios/${spaceId}/rendicion`,
        icon: faCalculator,
      },
    ]
  }, [spaceId])

  const hasAssociation = spaceDetail
    ? Boolean(spaceDetail.id && (spaceDetail.organizacion || spaceDetail.id))
    : null
  const spaceName = spaceDetail?.nombre || routeState?.spaceName || 'Espacio'
  const programName = spaceDetail?.programa?.nombre || routeState?.programName || ''
  const userDisplayName = (userProfile?.fullName || '').trim() || 'Usuario'

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

  if (hasAssociation === false) {
    return (
      <section>
        <div className={`mt-4 rounded-2xl border p-5 text-sm ${isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
          No hay un Espacio u Organización asociados para operar.
        </div>
      </section>
    )
  }

  return (
    <section>
      {isSingleSpaceUser ? (
        <div className={`mb-3 mt-1 ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
          <p className="text-[16px]">
            ¡Hola <strong>{userDisplayName}</strong>!
          </p>
        </div>
      ) : null}

      <div className="grid gap-4">
        {modules.map((module, index) => (
          <button
            key={module.id}
            type="button"
            onClick={() =>
              navigate(module.route, {
                state: { spaceName, programName },
              })
            }
            className="progressive-card relative rounded-[15px] border p-4 pr-12 text-left"
            style={{
              ...cardStyle,
              ['--card-delay' as string]: `${index * 70}ms`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center ${subtitleClass}`}>
                <FontAwesomeIcon icon={module.icon} aria-hidden="true" style={{ fontSize: 22 }} />
              </span>
              <p className={`text-[16px] font-medium ${titleClass}`}>{module.title}</p>
            </div>
            <span className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center ${subtitleClass}`}>
              <FontAwesomeIcon
                icon={faChevronLeft}
                aria-hidden="true"
                style={{ fontSize: 22, transform: 'rotate(180deg)' }}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

