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
import { AppLoadingSpinner } from './AppLoadingSpinner'
import { AppHeaderBar } from './AppHeaderBar'
import {
  BottomMenuBar,
  HomeIcon,
  ListIcon,
  MessagesIcon,
  RendicionIcon,
  SpacesIcon,
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
  const { theme, isDark, toggleTheme } = useAppTheme()
  const orgSpaceScopedMatch = location.pathname.match(/^\/app-org\/espacios\/(\d+)(?:\/.*)?$/)
  const isOrgSpaceScopedRoute = Boolean(orgSpaceScopedMatch)
  const isOrgHubRoute = /^\/app-org\/espacios\/\d+(?:\/hub)?\/?$/.test(location.pathname)
  const isSyncRoute = /^\/app-(org|user)\/sincronizacion\/?$/.test(location.pathname)
  const isMessagesRoute = /^\/app-(org|user)\/mensajes\/?$/.test(location.pathname)
  const isRendicionRoute =
    /^\/app-org\/rendicion\/?$/.test(location.pathname)
    || /^\/app-org\/espacios\/\d+\/rendicion(?:\/.*)?$/.test(location.pathname)
  const isNominaFormRoute = /^\/app-org\/espacios\/\d+\/nomina\/(?:nueva|\d+\/editar)\/?$/.test(
    location.pathname,
  )
  const isOrgSpacesHomeRoute = roleLabel === 'Organización' && /^\/app-org\/?$/.test(location.pathname)
  const isOrgMessagesHomeRoute =
    roleLabel === 'Organización' && /^\/app-org\/mensajes\/?$/.test(location.pathname)
  const headerState =
    (location.state as
      | { spaceName?: string; programName?: string; projectName?: string; organizationName?: string }
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
      : isSyncRoute
        ? 'Sincronización'
        : isRendicionRoute
          ? 'Rendición de Cuentas'
          : isOrgSpaceScopedRoute
            ? headerState?.spaceName || 'Espacio'
            : title
  const headerSubtitle = isOrgSpacesHomeRoute
    ? 'Hub de Espacios'
    : isOrgMessagesHomeRoute
      ? 'Mensajes'
      : isRendicionSelectorRoute
        ? 'Seleccioná organización y proyecto'
        : isRendicionRoute
          ? headerState?.projectName || headerState?.programName || 'Proyecto activo'
          : isOrgSpaceScopedRoute
            ? isInstitutionalRoute
              ? headerState?.programName || 'Programa sin definir'
              : ''
            : isSyncRoute
              ? ''
              : roleLabel

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

  const sessionLabel =
    sessionStatus === 'validated'
      ? 'Sesión validada'
      : sessionStatus === 'local'
        ? 'Sesión local sin red'
        : 'Requiere reingreso online'

  async function handleLogout() {
    setIsSettingsOpen(false)
    await logout()
    navigate('/', { replace: true })
  }

  const orgRendicionRoute = '/app-org/rendicion'
  const canManageRendicion = Boolean(
    userProfile?.permissions?.includes(MOBILE_RENDICION_PERMISSION),
  )

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
          ...(canManageRendicion
            ? [
                {
                  id: 'rendicion',
                  label: 'Rendición',
                  to: orgRendicionRoute,
                  icon: <RendicionIcon />,
                },
              ]
            : []),
        ]
      : [
          {
            id: 'inicio',
            label: 'Inicio',
            to: '/app-user',
            icon: <HomeIcon />,
          },
          {
            id: 'notas',
            label: 'Notas',
            to: '/app-user/notas',
            icon: <SpacesIcon />,
          },
          {
            id: 'mensajes',
            label: 'Mensajes',
            to: '/app-user/mensajes',
            icon: <MessagesIcon />,
          },
        ]

  const hideBackOnSingleSpaceHub = Boolean(orgSingleSpaceId) && isOrgHubRoute
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
          && !isRendicionRoute
          && !isNominaFormRoute
        }
        showBack={(isOrgSpaceScopedRoute || isSyncRoute) && !hideBackOnSingleSpaceHub}
        onBackClick={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          navigate(roleLabel === 'Organización' ? '/app-org' : '/app-user', { replace: true })
        }}
        onNotificationsClick={() =>
          navigate(
            roleLabel === 'Organización' ? '/app-org/mensajes' : '/app-user/mensajes',
          )
        }
        onSyncCenterClick={() =>
          navigate(roleLabel === 'Organización' ? '/app-org/sincronizacion' : '/app-user/sincronizacion')
        }
        hasPendingSync={pending > 0}
        notificationsBadgeCount={notificationsBadgeCount}
      />

      <main
        className="mx-auto w-full max-w-4xl px-4"
        style={{
          paddingTop: 'calc(102px + env(safe-area-inset-top) + 14px)',
          paddingBottom: 'calc(61px + env(safe-area-inset-bottom) + 16px)',
        }}
      >
        <div className="relative min-h-[320px]">
          <PageLoadingContext.Provider value={{ setPageLoading: setIsPageLoading }}>
            <div
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
