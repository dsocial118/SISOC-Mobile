import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faChevronLeft,
  faCircleInfo,
  faComments,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getSpaceDetail, listMySpaces, type SpaceDetail } from '../../api/spacesApi'
import { useAuth } from '../../auth/useAuth'
import { parseApiError } from '../../api/errorUtils'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/theme'
import { useSpaceUnreadMessages } from './useUnreadMessages'

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
  const routeState =
    (location.state as {
      spaceName?: string
      programName?: string
      fromSingleSpaceAuto?: boolean
    } | null) ?? null

  const hasFastContext = Boolean(routeState?.spaceName)
  const [spaceDetail, setSpaceDetail] = useState<SpaceDetail | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(!hasFastContext)
  const [isSingleSpaceUser, setIsSingleSpaceUser] = useState(false)
  const [hasOperationalAssociation, setHasOperationalAssociation] = useState<boolean | null>(
    null,
  )
  const unreadMessagesCount = useSpaceUnreadMessages(spaceId, userProfile?.username)

  useEffect(() => {
    let isMounted = true

    async function loadSpace() {
      const shouldBlockUi = !hasFastContext
      setPageLoading(shouldBlockUi)
      if (!spaceId) {
        setErrorMessage('No se encontró el espacio seleccionado.')
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
        if (shouldBlockUi) {
          setErrorMessage(parseApiError(error, 'No se pudo validar el espacio.'))
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
  }, [hasFastContext, location.pathname, navigate, routeState, setPageLoading, spaceId])

  useEffect(() => {
    let isMounted = true

    async function resolveAccessState() {
      const cacheKey = (userProfile?.username || '__anonymous__').trim() || '__anonymous__'
      const cached = getOrganizationSpacesCache(cacheKey)
      if (cached) {
        if (isMounted) {
          setIsSingleSpaceUser(cached.length === 1)
          setHasOperationalAssociation(
            Boolean(spaceId) && cached.some((space) => String(space.id) === String(spaceId)),
          )
        }
        return
      }

      try {
        const spaces = await listMySpaces()
        setOrganizationSpacesCache(cacheKey, spaces)
        if (isMounted) {
          setIsSingleSpaceUser(spaces.length === 1)
          setHasOperationalAssociation(
            Boolean(spaceId) && spaces.some((space) => String(space.id) === String(spaceId)),
          )
        }
      } catch {
        if (isMounted) {
          setIsSingleSpaceUser(false)
          setHasOperationalAssociation(null)
        }
      }
    }

    void resolveAccessState()
    return () => {
      isMounted = false
    }
  }, [spaceId, userProfile?.username])

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
    ]
  }, [spaceId])

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

  if (hasOperationalAssociation === false) {
    return (
      <section>
        <div
          className={`mt-4 rounded-2xl border p-5 text-sm ${
            isDark
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          Tu usuario no posee un espacio operativo configurado en SISOC Web. No es posible continuar hasta regularizar la configuración.
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
              <div className="flex items-center gap-2">
                <p className={`text-[16px] font-medium ${titleClass}`}>{module.title}</p>
                {module.id === 'mensajes' && unreadMessagesCount > 0 ? (
                  <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#D32F2F] px-[5px] text-[11px] font-bold leading-none text-white">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                ) : null}
              </div>
            </div>
            <span
              className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center ${subtitleClass}`}
            >
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
