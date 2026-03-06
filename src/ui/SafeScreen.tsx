import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

interface SafeScreenProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  fixed?: boolean
  withBasePadding?: boolean
}

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function SafeScreen({
  children,
  className,
  fixed = false,
  withBasePadding = false,
  style,
  ...props
}: SafeScreenProps) {
  const safeStyle: CSSProperties = withBasePadding
    ? {
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
      }
    : {
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }

  return (
    <div
      className={joinClasses(
        fixed ? 'fixed inset-0' : '',
        'min-h-[100dvh]',
        className,
      )}
      style={{ ...safeStyle, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

