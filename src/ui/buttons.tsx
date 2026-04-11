import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type AppButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    className?: string
  }
>

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline-secondary'
  | 'success'
  | 'danger'
  | 'outline-danger'

type ButtonSize = 'sm' | 'md' | 'lg'

export function joinClasses(...values: Array<string | undefined | false | null>): string {
  return values.filter(Boolean).join(' ')
}

export function appButtonClass({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
} = {}): string {
  const baseClass =
    'inline-flex items-center justify-center gap-2 border font-semibold transition-colors duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.12)] disabled:cursor-not-allowed disabled:opacity-60'

  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs'
      : size === 'lg'
        ? 'px-4 py-3 text-sm'
        : 'px-4 py-2 text-sm'

  const radiusClass = size === 'lg' || fullWidth ? 'rounded-xl' : 'rounded-full'

  const variantClass =
    variant === 'primary'
      ? 'border-[#232D4F] bg-[#232D4F] text-white hover:bg-[#1B2440]'
      : variant === 'secondary'
        ? 'border-[#6C757D] bg-[#6C757D] text-white hover:bg-[#5C636A]'
        : variant === 'outline-secondary'
          ? 'border-[#6C757D] bg-white text-[#6C757D] hover:bg-[#F8F9FA]'
          : variant === 'success'
            ? 'border-[#2E7D33] bg-[#2E7D33] text-white hover:bg-[#25672A]'
            : variant === 'danger'
              ? 'border-[#C62828] bg-[#C62828] text-white hover:bg-[#AA2222]'
              : 'border-[#C62828] bg-white text-[#C62828] hover:bg-[#FFF5F5]'

  return joinClasses(
    baseClass,
    radiusClass,
    sizeClass,
    fullWidth ? 'w-full' : undefined,
    variantClass,
  )
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
        appButtonClass({ variant: 'primary', size: 'lg' }),
        'w-[292px] rounded-[15px]',
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
        appButtonClass({ variant: 'outline-secondary', size: 'md' }),
        'w-[292px] rounded-[15px]',
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
        appButtonClass({ variant: 'success', size: 'md' }),
        'mx-[8px] my-[12px] w-[108px]',
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
        appButtonClass({ variant: 'success', size: 'sm' }),
        'mx-[8px] my-[12px] w-[80px]',
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
        appButtonClass({ variant: 'outline-danger', size: 'sm' }),
        'mx-[8px] my-[12px] w-[88px]',
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
        appButtonClass({ variant: 'outline-secondary', size: 'sm' }),
        'mx-[8px] my-[12px] w-[75px]',
        className,
      )}
      {...props}
    >
      {children}
    </BaseButton>
  )
}
