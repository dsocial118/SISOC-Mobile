interface AppLoadingSpinnerProps {
  size?: number
  className?: string
}

export function AppLoadingSpinner({ size = 200, className = '' }: AppLoadingSpinnerProps) {
  const strokeInner = Math.max(8, Math.round(size * 0.125))
  const ballSize = Math.max(8, Math.round(size * 0.13))
  const radius = size / 2 - strokeInner / 2
  const blueEndAngleDeg = 90
  const angleRad = (blueEndAngleDeg * Math.PI) / 180
  const ballLeft = size / 2 + Math.cos(angleRad) * radius - ballSize / 2
  const ballTop = size / 2 + Math.sin(angleRad) * radius - ballSize / 2

  return (
    <div
      className={`relative animate-spin ${className}`}
      style={{
        animationDuration: '1.6s',
        width: `${size}px`,
        height: `${size}px`,
      }}
      aria-label="Cargando"
      role="status"
    >
      <div
        className="h-full w-full rounded-full"
        style={{
          background: 'conic-gradient(from 180deg, #FFFFFF 0%, #3E5A7E 50%, #232D4F 100%)',
          WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${strokeInner}px), #000 calc(100% - ${strokeInner}px))`,
          mask: `radial-gradient(farthest-side, transparent calc(100% - ${strokeInner}px), #000 calc(100% - ${strokeInner}px))`,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: `${ballSize}px`,
          height: `${ballSize}px`,
          left: `${ballLeft}px`,
          top: `${ballTop}px`,
          backgroundColor: '#E7BA61',
        }}
      />
    </div>
  )
}

export default AppLoadingSpinner
