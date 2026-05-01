import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMobileScreenButton } from '@fortawesome/free-solid-svg-icons'

interface InstallNoticeCardProps {
  title: string
  children: ReactNode
  icon?: ReactNode
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
}

function DefaultDeviceIcon() {
  return <FontAwesomeIcon icon={faMobileScreenButton} aria-hidden="true" style={{ fontSize: 64 }} />
}

export function InstallNoticeCard({
  title,
  children,
  icon,
  primaryAction,
  secondaryAction,
}: InstallNoticeCardProps) {
  return (
    <section
      className="mx-[24px] my-[18px] min-h-[287px] w-[328px] max-w-[calc(100vw-48px)] rounded-[20px] border-2 border-[#E7BA61] bg-[#232D4F] px-6 py-5 text-white"
      style={{ WebkitTextSizeAdjust: '100%' }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-5">
          <div className="shrink-0">{icon || <DefaultDeviceIcon />}</div>
          <div className="min-w-0 pt-1">
            <h2 className="text-[20px] font-semibold leading-tight">{title}</h2>
          </div>
        </div>

        <div className="mt-4 text-[16px] font-normal leading-6">{children}</div>

        {primaryAction || secondaryAction ? (
          <div className="mt-4 flex items-center justify-end gap-[28px]">
            {secondaryAction}
            {primaryAction}
          </div>
        ) : null}
      </div>
    </section>
  )
}
