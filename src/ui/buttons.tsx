import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type AppButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    className?: string
  }
>

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

function BaseButton({ children, className, type = 'button', ...props }: AppButtonProps) {
  return (
    <button type={type} className={className} {...props}>
      {children}
    </button>
  )
}

export function LargeBlueButton({ children, className, ...props }: AppButtonProps) {
  return (
    <BaseButton
      className={joinClasses(
        'h-[36px] w-[292px] rounded-[25px] bg-[#232D4F] text-[16px] font-semibold text-white shadow-[2px_2px_2px_rgba(0,0,0,0.25)] disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  )
}

export function CreateButton({ children, className, ...props }: AppButtonProps) {
  return (
    <BaseButton
      className={joinClasses(
        'h-[36px] w-[292px] rounded-[20px] border border-[#E7BA61] bg-white text-[14px] font-semibold text-[#232D4F] shadow-[2px_2px_4px_rgba(0,0,0,0.25)]',
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  )
}

export function MediumGreenButton({ children, className, ...props }: AppButtonProps) {
  return (
    <BaseButton
      className={joinClasses(
        'mx-[8px] my-[12px] h-[36px] w-[108px] rounded-[25px] border border-[#2E7D33] bg-[#2E7D33] text-[14px] font-medium text-[#232D4F] shadow-[2px_2px_2px_rgba(0,0,0,0.25)] hover:bg-[rgba(46,125,51,0.7)] hover:border-[#2E7D33] active:border-[1.5px] active:border-[#E7BA61] active:bg-[#2E7D33]',
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  )
}

export function SmallGreenButton({ children, className, ...props }: AppButtonProps) {
  return (
    <BaseButton
      className={joinClasses(
        'mx-[8px] my-[12px] h-[36px] w-[80px] rounded-[25px] border border-[#2E7D33] bg-[#2E7D33] text-[16px] font-medium text-[#232D4F] shadow-[2px_2px_2px_rgba(0,0,0,0.25)] hover:bg-[rgba(46,125,51,0.7)] hover:border-[#2E7D33] active:border-[1.5px] active:border-[#E7BA61] active:bg-[#2E7D33]',
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  )
}

export function SmallRedButton({ children, className, ...props }: AppButtonProps) {
  return (
    <BaseButton
      className={joinClasses(
        'mx-[8px] my-[12px] h-[36px] w-[88px] rounded-[25px] border border-[#C62828] bg-white text-[14px] font-normal text-[#C62828] shadow-[2px_2px_2px_rgba(0,0,0,0.25)] hover:border-transparent hover:bg-[rgba(198,40,40,0.7)] hover:text-white active:border active:border-[#E7BA61] active:bg-[#C62828] active:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  )
}

export function SmallWhiteButton({ children, className, ...props }: AppButtonProps) {
  return (
    <BaseButton
      className={joinClasses(
        'mx-[8px] my-[12px] h-[36px] w-[75px] rounded-[25px] border-[3px] border-[#F2F2F2] bg-white text-[16px] font-semibold text-[#232D4F] shadow-[2px_2px_2px_rgba(0,0,0,0.25)] hover:bg-[rgba(255,255,255,0.7)] hover:border-[#F2F2F2] active:border-[2px] active:border-[#E7BA61] active:bg-white',
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  )
}
