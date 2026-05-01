import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { listMySpaces } from '../api/spacesApi'
import { useAuth } from '../auth/useAuth'
import { MOBILE_RENDICION_PERMISSION } from '../auth/permissionCodes'
import { buildOrganizationAccessSummary } from '../features/home/organizationAccess'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from '../features/home/organizationSpacesCache'
import { useOrganizationUnreadMessages } from '../features/home/useUnreadMessages'
import { syncNow } from '../sync/engine'
import { usePendingOutboxCount } from '../sync/usePendingOutboxCount'
import { syncPushSubscriptionForCurrentUser } from '../pwa/pushNotifications'
import { AppLoadingSpinner } from './AppLoadingSpinner'
import { AppHeaderBar } from './AppHeaderBar'
import {
  BottomMenuBar,
  HomeIcon,
  ListIcon,
  MessagesIcon,
} from './BottomMenuBar'
import { PageLoadingContext } from './PageLoadingContext'
import { SafeScreen } from './SafeScreen'
import { SettingsDrawer } from './SettingsDrawer'
import { useAppTheme } from './ThemeContext'

export function AppLayout({
  title,
  roleLabel,
}: {
  title: string
  roleLabel: string
}) {
  const { logout, sessionStatus, userProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const pending = usePendingOutboxCount()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [orgSingleSpaceId, setOrgSingleSpaceId] = useState<number | null>(null)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const { theme, isDark, toggleTheme } = useAppTheme()
  const orgSpaceScopedMatch = location.pathname.match(/^\/app-org\/espacios\/(\d+)(?:\/.*)?$/)
  const isOrgSpaceScopedRoute = Boolean(orgSpaceScopedMatch)
  const isOrgHubRoute = /^\/app-org\/espacios\/\d+(?:\/hub)?\/?$/.test(location.pathname)
  const isSyncRoute = /^\/app-(org|user)\/sincronizacion\/?$/.test(location.pathname)
  const isMessagesRoute = /^\/app-(org|user)\/mensajes\/?$/.test(location.pathname)
  const isNotificationsRoute = /^\/app-org\/notificaciones\/?$/.test(location.pathname)
  const isRendicionRoute =
    /^\/app-org\/rendicion\/?$/.test(location.pathname)
    || /^\/app-org\/espacios\/\d+\/rendicion(?:\/.*)?$/.test(location.pathname)
  const isNominaFormRoute = /^\/app-org\/espacios\/\d+\/nomina\/(?:nueva|\d+\/editar)\/?$/.test(
    location.pathname,
  )
  const isNominaAlimentariaRoute = /^\/app-org\/espacios\/\d+\/nomina-alimentaria\/?$/.test(
    location.pathname,
  )
  const isNominaAlimentariaPersonDetailRoute =
    /^\/app-org\/espacios\/\d+\/nomina-alimentaria\/\d+\/?$/.test(location.pathname)
  const isNominaRoute = /^\/app-org\/espacios\/\d+\/nomina\/?$/.test(location.pathname)
  const isActivitiesRoute = /^\/app-org\/espacios\/\d+\/actividades(?:\/nueva|\/\d+)?\/?$/.test(location.pathname)
  const isCursosRoute = /^\/app-org\/espacios\/\d+\/cursos\/?$/.test(location.pathname)
  const isOrgSpacesHomeRoute = roleLabel === 'Organización' && /^\/app-org\/?$/.test(location.pathname)
  const isOrgMessagesHomeRoute =
    roleLabel === 'Organización' && /^\/app-org\/mensajes\/?$/.test(location.pathname)
  const isOrgNotificationsHomeRoute =
    roleLabel === 'Organización' && /^\/app-org\/notificaciones\/?$/.test(location.pathname)
  const headerState =
    (location.state as
      | {
        spaceName?: string
        programName?: string
        projectName?: string
        organizationName?: string
        personName?: string
      }
      | null) ?? null
  const isRendicionSelectorRoute = /^\/app-org\/rendicion\/?$/.test(location.pathname)
  const isInstitutionalRoute = location.pathname.endsWith('/informacion')
  const organizationWelcomeTitle = userProfile?.fullName?.trim()
    ? `Bienvenido ${userProfile.fullName.trim()}`
    : 'Bienvenido'
  const headerTitle = isOrgSpacesHomeRoute
    ? organizationWelcomeTitle
    : isOrgMessagesHomeRoute
      ? 'Organización'
      : isOrgNotificationsHomeRoute
        ? 'Organización'
      : isSyncRoute
        ? 'Sincronización'
      : isRendicionRoute
        ? 'Rendición de Cuentas'
        : isNominaAlimentariaRoute
          || isNominaRoute
          ? 'Beneficiarios'
        : isActivitiesRoute
          ? 'Actividades del Espacio'
        : isCursosRoute
          ? 'Cursos'
        : isNominaAlimentariaPersonDetailRoute
          ? headerState?.spaceName || 'Espacio'
        : isOrgSpaceScopedRoute
          ? headerState?.spaceName || 'Espacio'
          : title
  const headerSubtitle = isOrgSpacesHomeRoute
    ? 'Hub de Espacios'
    : isOrgMessagesHomeRoute
      ? 'Mensajes'
      : isOrgNotificationsHomeRoute
        ? 'Notificaciones'
      : isRendicionSelectorRoute
        ? 'Seleccioná organización y proyecto'
      : isRendicionRoute
        ? headerState?.projectName || headerState?.programName || 'Proyecto activo'
        : isNominaAlimentariaRoute
          || isNominaRoute
          ? headerState?.spaceName || 'Espacio'
        : isActivitiesRoute
          ? headerState?.spaceName || 'Espacio'
        : isCursosRoute
          ? headerState?.spaceName || 'Espacio'
        : isNominaAlimentariaPersonDetailRoute
          ? headerState?.personName || ''
        : isOrgSpaceScopedRoute
          ? isInstitutionalRoute
            ? headerState?.programName || 'Programa sin definir'
              : ''
            : isSyncRoute
              ? ''
              : roleLabel
  const canManageRendicion = Boolean(
    userProfile?.permissions?.includes(MOBILE_RENDICION_PERMISSION),
  )

  useEffect(() => {
    let isMounted = true

    async function resolveOrgNavMode() {
      if (roleLabel !== 'Organización') {
        return
      }

      const cacheKey = (userProfile?.username || '__anonymous__').trim() || '__anonymous__'
      const cached = getOrganizationSpacesCache(cacheKey)
      if (cached) {
        if (isMounted) {
          setOrgSingleSpaceId(buildOrganizationAccessSummary(cached).autoEnterSpace?.id ?? null)
        }
        return
      }

      try {
        const spaces = await listMySpaces()
        setOrganizationSpacesCache(cacheKey, spaces)
        if (isMounted) {
          setOrgSingleSpaceId(buildOrganizationAccessSummary(spaces).autoEnterSpace?.id ?? null)
        }
      } catch {
        if (isMounted) {
          setOrgSingleSpaceId(null)
        }
      }
    }

    void resolveOrgNavMode()
    return () => {
      isMounted = false
    }
  }, [roleLabel, userProfile?.username])

  useEffect(() => {
    if (
      roleLabel !== 'Organización'
      || !canManageRendicion
      || sessionStatus === 'reauth'
    ) {
      return
    }
    void syncPushSubscriptionForCurrentUser().catch(() => {
      // No romper la carga principal si falla el alta/sync de push.
    })
  }, [canManageRendicion, roleLabel, sessionStatus, userProfile?.username])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let touchStartY = 0
    let touchStartX = 0
    let canPull = false
    let pulling = false
    let gestureLocked = false
    const pullThreshold = 90
    const verticalTolerance = 12

    function isScrollableElement(element: Element): element is HTMLElement {
      if (!(element instanceof HTMLElement)) {
        return false
      }
      const overflowY = window.getComputedStyle(element).overflowY
      return (
        (overflowY === 'auto' || overflowY === 'scroll')
        && element.scrollHeight > element.clientHeight
      )
    }

    function canStartPullFromTarget(target: EventTarget | null): boolean {
      let current = target instanceof Element ? target : null
      while (current) {
        if (isScrollableElement(current)) {
          return current.scrollTop <= 0
        }
        current = current.parentElement
      }
      return window.scrollY <= 0
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        canPull = false
        pulling = false
        gestureLocked = false
        return
      }
      touchStartY = event.touches[0].clientY
      touchStartX = event.touches[0].clientX
      canPull = canStartPullFromTarget(event.target)
      pulling = false
      gestureLocked = false
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!canPull || isPullRefreshing || event.touches.length !== 1) {
        return
      }
      const deltaY = event.touches[0].clientY - touchStartY
      const deltaX = event.touches[0].clientX - touchStartX

      if (!gestureLocked) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          canPull = false
          return
        }
        if (deltaY < -verticalTolerance) {
          canPull = false
          return
        }
        if (deltaY > verticalTolerance) {
          gestureLocked = true
        }
      }

      if (deltaY > pullThreshold) {
        pulling = true
      }
    }

    const onTouchEnd = () => {
      if (!pulling || isPullRefreshing) {
        return
      }
      setIsPullRefreshing(true)
      window.setTimeout(() => {
        setRefreshNonce((current) => current + 1)
        setIsPullRefreshing(false)
      }, 180)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isPullRefreshing, navigate])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const sessionLabel =
    sessionStatus === 'validated'
      ? 'Sesión validada'
      : 'Requiere reingreso online'

  async function handleLogout() {
    setIsSettingsOpen(false)
    await logout()
    navigate('/', { replace: true })
  }

  const navItems =
    roleLabel === 'Organización'
      ? [
          orgSingleSpaceId
            ? {
                id: 'inicio',
                label: 'Inicio',
                to: `/app-org/espacios/${orgSingleSpaceId}/hub`,
                icon: <HomeIcon />,
              }
            : {
                id: 'inicio',
                label: 'Espacios',
                to: '/app-org',
                icon: <ListIcon />,
              },
          {
            id: 'mensajes',
            label: 'Mensajes',
            to: '/app-org/mensajes',
            icon: <MessagesIcon />,
          },
        ]
      : [
          {
            id: 'inicio',
            label: 'Inicio',
            to: '/app-user',
            icon: <HomeIcon />,
          },
          {
            id: 'mensajes',
            label: 'Mensajes',
            to: '/app-user/mensajes',
            icon: <MessagesIcon />,
          },
        ]

  const hideBackOnSingleSpaceHub = Boolean(orgSingleSpaceId) && isOrgHubRoute
  const isOrgRootRoute = /^\/app-org\/?$/.test(location.pathname)
  const isUserRootRoute = /^\/app-user\/?$/.test(location.pathname)
  const isOrgMessagesRootRoute = /^\/app-org\/mensajes\/?$/.test(location.pathname)
  const isUserMessagesRootRoute = /^\/app-user\/mensajes\/?$/.test(location.pathname)
  const isOrgNotificationsRootRoute = /^\/app-org\/notificaciones\/?$/.test(location.pathname)
  const isRootNavigationRoute =
    isOrgRootRoute
    || isUserRootRoute
    || isOrgMessagesRootRoute
    || isUserMessagesRootRoute
    || isOrgNotificationsRootRoute
    || hideBackOnSingleSpaceHub
  const shouldShowBack = !isRootNavigationRoute
  const organizationUnreadState = useOrganizationUnreadMessages(userProfile?.username)
  const notificationsBadgeCount =
    roleLabel === 'Organización' ? organizationUnreadState.unreadCount : 0

  const contentBg = isDark ? 'bg-[#3E5A7E]' : 'bg-white'
  const showSkeletonOverlay = isPageLoading

  return (
    <SafeScreen className={contentBg} style={{ paddingTop: 0 }}>
      <AppHeaderBar
        title={headerTitle}
        subtitle={headerSubtitle}
        titleOnTop={isOrgSpacesHomeRoute || isOrgMessagesHomeRoute}
        onSync={() => void syncNow()}
        showSync={
          !(roleLabel === 'Organización' && location.pathname === '/app-org')
          && !isOrgSpaceScopedRoute
          && !isMessagesRoute
          && !isNotificationsRoute
          && !isRendicionRoute
          && !isNominaFormRoute
        }
        showBack={shouldShowBack}
        onBackClick={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          navigate(roleLabel === 'Organización' ? '/app-org' : '/app-user', { replace: true })
        }}
        onNotificationsClick={() =>
          navigate(
            roleLabel === 'Organización' ? '/app-org/notificaciones' : '/app-user/mensajes',
          )
        }
        onSyncCenterClick={() =>
          navigate(roleLabel === 'Organización' ? '/app-org/sincronizacion' : '/app-user/sincronizacion')
        }
        hasPendingSync={pending > 0}
        notificationsBadgeCount={notificationsBadgeCount}
      />

      {isPullRefreshing ? (
        <div className="fixed inset-x-0 top-[calc(102px+env(safe-area-inset-top))] z-40 flex justify-center px-4">
          <div
            className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-2 shadow-sm ${
              isDark
                ? 'border-white/20 bg-[#232D4F] text-white'
                : 'border-slate-200 bg-white text-[#232D4F]'
            }`}
          >
            <AppLoadingSpinner size={22} />
            <span className="text-[12px] font-semibold">Cargando tu información</span>
          </div>
        </div>
      ) : null}

      {isOffline ? (
        <div className="fixed inset-x-0 top-[calc(102px+env(safe-area-inset-top))] z-30 px-4">
          <div className="mx-auto w-full max-w-4xl rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 px-4 py-2 text-center text-[12px] font-semibold text-white">
            Sin conexión. Mostrando datos guardados.
          </div>
        </div>
      ) : null}

      <main
        className="mx-auto w-full max-w-4xl px-4"
        style={{
          paddingTop: isOffline
            ? 'calc(102px + env(safe-area-inset-top) + 52px)'
            : 'calc(102px + env(safe-area-inset-top) + 14px)',
          paddingBottom: 'calc(61px + env(safe-area-inset-bottom) + 16px)',
        }}
      >
        <div className="relative min-h-[320px]">
          <PageLoadingContext.Provider value={{ setPageLoading: setIsPageLoading }}>
            <div
              key={`${location.pathname}:${refreshNonce}`}
              className={`page-fade-in transition-opacity ${showSkeletonOverlay ? 'opacity-0' : 'opacity-100'}`}
            >
              <Outlet />
            </div>
          </PageLoadingContext.Provider>
          {showSkeletonOverlay ? (
            <div className="pointer-events-none absolute inset-0 z-20">
              <PageSkeleton isDark={isDark} />
            </div>
          ) : null}
        </div>
      </main>

      <BottomMenuBar
        items={navItems}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSettingsOpen={isSettingsOpen}
      />

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userProfile={userProfile}
        sessionLabel={sessionLabel}
        pendingCount={pending}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={() => void handleLogout()}
      />
    </SafeScreen>
  )
}

function PageSkeleton({ isDark }: { isDark: boolean }) {
  const cardBg = isDark ? 'bg-white/10 border-white/20' : 'bg-white border-slate-200'
  const barColor = isDark ? 'bg-white/35' : 'bg-slate-200'
  const textColor = isDark ? 'text-white' : 'text-[#232D4F]'

  return (
    <section className="space-y-4">
      <div className={`skeleton-shimmer h-5 w-40 rounded-full ${barColor}`} />
      <div className={`rounded-2xl border p-5 shadow-sm ${cardBg}`}>
        <div className={`skeleton-shimmer h-4 w-1/3 rounded-full ${barColor}`} />
        <div className="mt-3 space-y-2">
          <div className={`skeleton-shimmer h-3 w-full rounded-full ${barColor}`} />
          <div className={`skeleton-shimmer h-3 w-11/12 rounded-full ${barColor}`} />
          <div className={`skeleton-shimmer h-3 w-8/12 rounded-full ${barColor}`} />
        </div>
      </div>
      <div className={`rounded-2xl border p-5 shadow-sm ${cardBg}`}>
        <div className={`skeleton-shimmer h-4 w-1/2 rounded-full ${barColor}`} />
        <div className="mt-3 space-y-2">
          <div className={`skeleton-shimmer h-3 w-10/12 rounded-full ${barColor}`} />
          <div className={`skeleton-shimmer h-3 w-7/12 rounded-full ${barColor}`} />
        </div>
      </div>
      <div className={`pt-1 text-center ${textColor}`}>
        <div className="flex justify-center">
          <AppLoadingSpinner size={54} />
        </div>
        <p className="mt-2 text-[13px] font-semibold">Cargando tu información</p>
      </div>
    </section>
  )
}

