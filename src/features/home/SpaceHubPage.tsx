import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalculator,
  faCalendarDays,
  faChevronLeft,
  faCircleInfo,
  faComments,
  faGraduationCap,
  faUtensils,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { getSpaceDetail, listMySpaces, type SpaceDetail } from '../../api/spacesApi'
import { listSpaceNomina, type NominaTab } from '../../api/nominaApi'
import { listActivityCatalog, listActivityDays, listSpaceActivities } from '../../api/activitiesApi'
import { listSpaceMessages } from '../../api/messagesApi'
import { useAuth } from '../../auth/useAuth'
import { parseApiError } from '../../api/errorUtils'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'
import { AppLoadingSpinner } from '../../ui/AppLoadingSpinner'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import { useSpaceUnreadMessages } from './useUnreadMessages'

interface HubModule {
  id: string
  title: string
  route: string
  icon: IconDefinition
}

function HubModulesSkeleton({ isDark }: { isDark: boolean }) {
  const cardClass = isDark
    ? 'border-white/15 bg-white/10'
    : 'border-slate-200 bg-white'
  const lineClass = isDark ? 'bg-white/20' : 'bg-slate-200'
  const textClass = isDark ? 'text-white' : 'text-[#232D4F]'

  return (
    <section className="space-y-4">
      <div className="grid gap-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`rounded-[15px] border p-4 pr-12 ${cardClass} animate-pulse`}
          >
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full ${lineClass}`} />
              <div className={`h-4 w-48 rounded ${lineClass}`} />
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

function normalizeProgramName(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function hasRendicionPermission(permissions: string[] | undefined): boolean {
  if (!permissions || permissions.length === 0) {
    return false
  }
  return permissions.some((permission) =>
    String(permission || '')
      .trim()
      .toLowerCase()
      .includes('manage_mobile_rendicion'),
  )
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
  const [associatedProgramName, setAssociatedProgramName] = useState(routeState?.programName || '')
  const unreadMessagesCount = useSpaceUnreadMessages(spaceId, userProfile?.username)
  const canManageRendicion = hasRendicionPermission(userProfile?.permissions)

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
        const nextProgramName =
          detail.programa?.nombre || associatedProgramName || routeState?.programName || ''
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
  }, [
    associatedProgramName,
    hasFastContext,
    location.pathname,
    navigate,
    routeState,
    setPageLoading,
    spaceId,
  ])

  useEffect(() => {
    let isMounted = true

    async function resolveAccessState() {
      const cacheKey = (userProfile?.username || '__anonymous__').trim() || '__anonymous__'
      const cached = getOrganizationSpacesCache(cacheKey)
      if (cached) {
        const matchedSpace = cached.find((space) => String(space.id) === String(spaceId))
        if (isMounted) {
          setAssociatedProgramName(matchedSpace?.programa__nombre || routeState?.programName || '')
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
        const matchedSpace = spaces.find((space) => String(space.id) === String(spaceId))
        if (isMounted) {
          setAssociatedProgramName(matchedSpace?.programa__nombre || routeState?.programName || '')
          setIsSingleSpaceUser(spaces.length === 1)
          setHasOperationalAssociation(
            Boolean(spaceId) && spaces.some((space) => String(space.id) === String(spaceId)),
          )
        }
      } catch {
        if (isMounted) {
          setAssociatedProgramName(routeState?.programName || '')
          setIsSingleSpaceUser(false)
          setHasOperationalAssociation(null)
        }
      }
    }

    void resolveAccessState()
    return () => {
      isMounted = false
    }
  }, [routeState?.programName, spaceId, userProfile?.username])

  const spaceName = spaceDetail?.nombre || routeState?.spaceName || 'Espacio'
  const programName =
    spaceDetail?.programa?.nombre || associatedProgramName || routeState?.programName || ''
  const normalizedProgramName = normalizeProgramName(programName)
  const convenioTipo = String(spaceDetail?.datos_convenio_mobile?.tipo || '')
    .trim()
    .toLowerCase()
  const isPnudProgram = normalizedProgramName.includes('pnud') || convenioTipo === 'pnud'
  const hasProgramDefined = Boolean(normalizedProgramName)
  const isResolvingHub = loading || hasOperationalAssociation === null || !spaceDetail
  const modules = useMemo<HubModule[]>(() => {
    if (!spaceId) {
      return []
    }

    const baseModules: HubModule[] = [
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
    ]

    if (normalizedProgramName.includes('abordaje comunitario')) {
      const modulesForProgram: HubModule[] = [...baseModules]
      if (isPnudProgram) {
        modulesForProgram.push({
          id: 'actividades',
          title: 'Actividades',
          route: `/app-org/espacios/${spaceId}/actividades`,
          icon: faCalendarDays,
        })
      }
      modulesForProgram.push(
        {
          id: 'nomina',
          title: 'Beneficiarios',
          route: `/app-org/espacios/${spaceId}/nomina`,
          icon: faUsers,
        },
      )
      if (canManageRendicion && isPnudProgram) {
        modulesForProgram.push({
          id: 'rendiciones',
          title: 'Rendiciones',
          route: `/app-org/rendicion`,
          icon: faCalculator,
        })
      }
      if (isPnudProgram) {
        modulesForProgram.push({
          id: 'cursos',
          title: 'Formación',
          route: `/app-org/espacios/${spaceId}/cursos`,
          icon: faGraduationCap,
        })
      }
      return modulesForProgram
    }

    if (normalizedProgramName.includes('alimentar comunidad')) {
      const modulesForProgram: HubModule[] = [...baseModules]
      if (isPnudProgram) {
        modulesForProgram.push({
          id: 'actividades',
          title: 'Actividades',
          route: `/app-org/espacios/${spaceId}/actividades`,
          icon: faCalendarDays,
        })
      }
      modulesForProgram.push(
        {
          id: 'capacitaciones-obligatorias',
          title: 'Capacitaciones Obligatorias',
          route: `/app-org/espacios/${spaceId}/informacion/capacitaciones`,
          icon: faCircleInfo,
        },
        {
          id: 'nomina-alimentaria',
          title: 'Beneficiarios',
          route: `/app-org/espacios/${spaceId}/nomina-alimentaria`,
          icon: faUtensils,
        },
      )
      if (canManageRendicion && isPnudProgram) {
        modulesForProgram.push({
          id: 'rendiciones',
          title: 'Rendiciones',
          route: `/app-org/rendicion`,
          icon: faCalculator,
        })
      }
      if (isPnudProgram) {
        modulesForProgram.push({
          id: 'cursos',
          title: 'Formación',
          route: `/app-org/espacios/${spaceId}/cursos`,
          icon: faGraduationCap,
        })
      }
      return modulesForProgram
    }

    if (isPnudProgram) {
      const modulesForProgram: HubModule[] = [
        ...baseModules,
        {
          id: 'actividades',
          title: 'Actividades',
          route: `/app-org/espacios/${spaceId}/actividades`,
          icon: faCalendarDays,
        },
        {
          id: 'cursos',
          title: 'Formación',
          route: `/app-org/espacios/${spaceId}/cursos`,
          icon: faGraduationCap,
        },
      ]
      if (canManageRendicion) {
        modulesForProgram.push({
          id: 'rendiciones',
          title: 'Rendiciones',
          route: `/app-org/rendicion`,
          icon: faCalculator,
        })
      }
      return modulesForProgram
    }

    return baseModules
  }, [canManageRendicion, isPnudProgram, normalizedProgramName, spaceId])
  const userDisplayName = (userProfile?.fullName || '').trim() || 'Usuario'

  useEffect(() => {
    if (!spaceId) {
      return
    }

    const preloadTasks: Array<Promise<unknown>> = [getSpaceDetail(spaceId), listSpaceMessages(spaceId)]

    let nominaTab: NominaTab = 'consolidada'
    if (normalizedProgramName.includes('alimentar comunidad')) {
      nominaTab = 'alimentaria'
    } else if (normalizedProgramName.includes('abordaje comunitario')) {
      nominaTab = 'formacion'
    }

    preloadTasks.push(listSpaceNomina(spaceId, { tab: nominaTab }))

    if (
      normalizedProgramName.includes('alimentar comunidad')
      || normalizedProgramName.includes('abordaje comunitario')
    ) {
      preloadTasks.push(listActivityCatalog(spaceId))
      preloadTasks.push(listActivityDays(spaceId))
      preloadTasks.push(listSpaceActivities(spaceId))
    }

    void Promise.allSettled(preloadTasks)
  }, [normalizedProgramName, spaceId])

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

  if (isResolvingHub) {
    return (
      <section>
        {isSingleSpaceUser ? (
          <div className={`mb-3 mt-1 ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
            <p className="text-[16px]">
              ¡Hola <strong>{userDisplayName}</strong>!
            </p>
          </div>
        ) : null}
        <HubModulesSkeleton isDark={isDark} />
      </section>
    )
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
          Tu usuario no posee un espacio operativo configurado en SISOC Web. No es posible
          continuar hasta regularizar la configuración.
        </div>
      </section>
    )
  }

  const showMissingProgramMessage = !hasProgramDefined

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
            onClick={() => {
              setPageLoading(true)
              navigate(module.route, {
                state: { spaceName, programName },
              })
            }}
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

        {showMissingProgramMessage ? (
          <div className="flex min-h-[32vh] items-center justify-center px-4 text-center">
            <p
              className={`max-w-[24rem] text-sm leading-6 ${isDark ? 'text-white' : 'text-slate-700'}`}
            >
              No hay programa definido.
              <br />
              Comuníquese con un administrador de la aplicación.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}




