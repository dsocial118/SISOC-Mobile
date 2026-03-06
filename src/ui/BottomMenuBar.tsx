import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faComments,
  faGear,
  faHouse,
  faList,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppTheme } from './ThemeContext'

interface BottomMenuItem {
  id: string
  label: string
  to: string
  icon: ReactNode
}

interface BottomMenuBarProps {
  items: BottomMenuItem[]
  onOpenSettings: () => void
  isSettingsOpen: boolean
}

export function BottomMenuBar({
  items,
  onOpenSettings,
  isSettingsOpen,
}: BottomMenuBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useAppTheme()
  const isDark = theme === 'dark'

  const bgColor = isDark ? '#232D4F' : '#F5F5F5'
  const fgColor = isDark ? '#FFFFFF' : '#232D4F'
  const activeColor = '#E7BA61'
  const totalSlots = items.length + 1

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40"
      aria-label="Navegación principal"
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          backgroundColor: bgColor,
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 10px rgba(0, 0, 0, 0.16)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[#E7BA61]" />
        <ul
          className="grid h-[61px] w-full items-center px-4 pb-[8px] pt-[12px]"
          style={{ gridTemplateColumns: `repeat(${totalSlots}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const isActive =
              item.id === 'inicio'
                ? location.pathname === item.to
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
            return (
              <li key={item.id} className="flex h-full items-center justify-center">
                <button
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[8px] transition-colors"
                  style={{
                    color: isActive ? activeColor : fgColor,
                    opacity: isActive ? 1 : 0.86,
                    fontWeight: isActive ? 700 : 600,
                  }}
                >
                  <span className="h-[22px] w-[22px]">{item.icon}</span>
                  <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                </button>
              </li>
            )
          })}
          <li className="flex h-full items-center justify-center">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[8px] transition-colors"
              style={{
                color: isSettingsOpen ? activeColor : fgColor,
                opacity: isSettingsOpen ? 1 : 0.86,
                fontWeight: isSettingsOpen ? 700 : 600,
              }}
            >
              <span className="h-[22px] w-[22px]">
                <SettingsIcon />
              </span>
              <span className="text-[10px] font-semibold leading-none">Ajustes</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export function HomeIcon() {
  return <FontAwesomeIcon icon={faHouse} aria-hidden="true" style={{ fontSize: 22 }} />
}

export function SpacesIcon() {
  return (
    <FontAwesomeIcon
      icon={faTableCellsLarge}
      aria-hidden="true"
      style={{ fontSize: 22 }}
    />
  )
}

export function ListIcon() {
  return <FontAwesomeIcon icon={faList} aria-hidden="true" style={{ fontSize: 22 }} />
}

export function MessagesIcon() {
  return <FontAwesomeIcon icon={faComments} aria-hidden="true" style={{ fontSize: 22 }} />
}

export function SettingsIcon() {
  return <FontAwesomeIcon icon={faGear} aria-hidden="true" style={{ fontSize: 22 }} />
}
