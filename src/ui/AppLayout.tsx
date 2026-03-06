import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Outlet, useNavigate } from 'react-router-dom'
import { listMySpaces } from '../api/spacesApi'
import { useAuth } from '../auth/useAuth'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from '../features/home/organizationSpacesCache'
import { usePendingOutboxCount } from '../sync/usePendingOutboxCount'
import { syncNow } from '../sync/engine'
import { AppLoadingSpinner } from './AppLoadingSpinner'
import { PageLoadingContext } from './PageLoadingContext'
import { SafeScreen } from './SafeScreen'
import { AppHeaderBar } from './AppHeaderBar'
import {
  BottomMenuBar,
  HomeIcon,
  ListIcon,
  MessagesIcon,
  SpacesIcon,
} from './BottomMenuBar'
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
  const [showPageSkeleton, setShowPageSkeleton] = useState(true)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [orgSingleSpaceId, setOrgSingleSpaceId] = useState<number | null>(null)
  const { theme, isDark, toggleTheme } = useAppTheme()
  const orgSpaceScopedMatch = location.pathname.match(
    /^\/app-org\/espacios\/(\d+)(?:\/(hub|informacion|mensajes|actividades|nomina|rendicion))?$/,
  )
  const isOrgSpaceScopedRoute = Boolean(orgSpaceScopedMatch)
  const isOrgHubRoute = /^\/app-org\/espacios\/\d+(?:\/hub)?\/?$/.test(location.pathname)
  const isSyncRoute = /^\/app-(org|user)\/sincronizacion\/?$/.test(location.pathname)
  const isMessagesRoute = /^\/app-(org|user)\/mensajes\/?$/.test(location.pathname)
  const isOrgSpacesHomeRoute = roleLabel === 'Organización' && /^\/app-org\/?$/.test(location.pathname)
  const headerState = (location.state as { spaceName?: string; programName?: string } | null) ?? null
  const isInstitutionalRoute = location.pathname.endsWith('/informacion')
  const headerTitle = isOrgSpacesHomeRoute
    ? 'Organización'
    : isSyncRoute
    ? 'Sincronización'
    : isOrgSpaceScopedRoute
      ? headerState?.spaceName || 'Espacio'
      : title
  const headerSubtitle = isOrgSpacesHomeRoute
    ? 'Selector de Espacios'
    : isOrgSpaceScopedRoute
    ? isInstitutionalRoute
      ? headerState?.programName || 'Programa sin definir'
      : ''
    : isSyncRoute
      ? ''
      : roleLabel

  useEffect(() => {
    setShowPageSkeleton(true)

    const timer = window.setTimeout(() => {
      setShowPageSkeleton(false)
    }, 180)

    return () => {
      window.clearTimeout(timer)
    }
  }, [location.pathname])

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
          setOrgSingleSpaceId(cached.length === 1 ? cached[0].id : null)
        }
        return
      }

      try {
        const spaces = await listMySpaces()
        setOrganizationSpacesCache(cacheKey, spaces)
        if (isMounted) {
          setOrgSingleSpaceId(spaces.length === 1 ? spaces[0].id : null)
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

  const contentBg = isDark ? 'bg-[#3E5A7E]' : 'bg-white'

  const showSkeletonOverlay = showPageSkeleton || isPageLoading

  return (
    <SafeScreen className={contentBg} style={{ paddingTop: 0 }}>
      <AppHeaderBar
        title={headerTitle}
        subtitle={headerSubtitle}
        titleOnTop={isOrgSpacesHomeRoute}
        onSync={() => void syncNow()}
        showSync={
          !(roleLabel === 'Organización' && location.pathname === '/app-org')
          && !isOrgSpaceScopedRoute
          && !isMessagesRoute
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
          navigate(roleLabel === 'Organización' ? '/app-org/mensajes' : '/app-user/mensajes')
        }
        onSyncCenterClick={() =>
          navigate(roleLabel === 'Organización' ? '/app-org/sincronizacion' : '/app-user/sincronizacion')
        }
        hasPendingSync={pending > 0}
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
              key={location.pathname}
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


