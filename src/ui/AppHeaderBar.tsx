import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faChevronLeft,
  faCloudArrowUp,
  faRotateRight,
} from '@fortawesome/free-solid-svg-icons'

interface AppHeaderBarProps {
  title: string
  subtitle: string
  titleOnTop?: boolean
  onSync: () => void
  showSync?: boolean
  showBack?: boolean
  onBackClick?: () => void
  onNotificationsClick?: () => void
  onSyncCenterClick?: () => void
  hasPendingSync?: boolean
  notificationsBadgeCount?: number
}

export function AppHeaderBar({
  title,
  subtitle,
  titleOnTop = false,
  onSync,
  showSync = true,
  showBack = false,
  onBackClick,
  onNotificationsClick,
  onSyncCenterClick,
  hasPendingSync = false,
  notificationsBadgeCount = 0,
}: AppHeaderBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 w-full">
      <div
        className="relative w-full overflow-hidden rounded-b-[50px] border-b-[2px] border-x-[2px] border-[#E7BA61] bg-[#232D4F]"
        style={{
          height: 'calc(102px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: '0 6px 12px rgba(0, 0, 0, 0.18)',
        }}
      >
        <div className="mx-[30px] flex h-[102px] items-center justify-between">
          {showBack ? (
            <button
              type="button"
              aria-label="Volver"
              title="Volver"
              onClick={onBackClick}
              className="-ml-2 flex h-[34px] w-[34px] items-center justify-center text-white"
            >
              <FontAwesomeIcon
                icon={faChevronLeft}
                aria-hidden="true"
                style={{ fontSize: 22, color: '#F2F2F2' }}
              />
            </button>
          ) : showSync ? (
            <button
              type="button"
              aria-label="Sincronizar"
              title="Sincronizar"
              onClick={onSync}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/20 bg-white/5"
            >
              <FontAwesomeIcon
                icon={faRotateRight}
                aria-hidden="true"
                style={{ fontSize: 20, color: '#F2F2F2' }}
              />
            </button>
          ) : (
            <span className="h-[20px] w-[8px]" aria-hidden="true" />
          )}

          <div
            className={`mr-auto flex h-[38px] w-full max-w-[352px] flex-col justify-center gap-[2px] text-white ${
              showBack ? 'ml-5' : showSync ? 'ml-3' : 'ml-1'
            }`}
          >
            {titleOnTop ? (
              <>
                <h1 className="text-[16px] font-medium leading-none">{title}</h1>
                <p className="text-[12px] font-medium leading-none tracking-[0.04em]">{subtitle}</p>
              </>
            ) : (
              <>
                <p className="text-[12px] font-medium leading-none tracking-[0.04em]">{subtitle}</p>
                <h1 className="text-[16px] font-medium leading-none">{title}</h1>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Estado de sincronización"
              title={hasPendingSync ? 'Hay datos pendientes de sincronizar' : 'Todo sincronizado'}
              onClick={onSyncCenterClick}
              className="flex h-[34px] w-[34px] items-center justify-center"
            >
              <FontAwesomeIcon
                icon={faCloudArrowUp}
                aria-hidden="true"
                style={{ fontSize: 20, color: hasPendingSync ? '#E7BA61' : '#32A852' }}
              />
            </button>

            <button
              type="button"
              aria-label="Notificaciones"
              title="Notificaciones"
              onClick={onNotificationsClick}
              className="relative flex h-[34px] w-[34px] items-center justify-center"
            >
              <FontAwesomeIcon icon={faBell} aria-hidden="true" style={{ fontSize: 20, color: '#F2F2F2' }} />
              {notificationsBadgeCount > 0 ? (
                <span className="absolute -right-[2px] -top-[6px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-[1.5px] border-white bg-[#D32F2F] px-[4px] text-[10px] font-extrabold leading-none tracking-[-0.01em] text-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
                  {notificationsBadgeCount > 99 ? '99+' : notificationsBadgeCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

