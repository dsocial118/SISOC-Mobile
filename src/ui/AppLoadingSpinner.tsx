interface AppLoadingSpinnerProps {
  size?: number
  className?: string
  cutoutColor?: string
  middleColor?: string
}

export function AppLoadingSpinner({
  size = 200,
  className = '',
  cutoutColor,
  middleColor = '#3E5A7E',
}: AppLoadingSpinnerProps) {
  const strokeInner = Math.max(8, Math.round(size * 0.125))
  const ballSize = Math.max(8, Math.round(size * 0.13))
  const inset = Math.ceil(ballSize / 2) + 1
  const ringSize = Math.max(1, size - inset * 2)
  const radius = ringSize / 2 - strokeInner / 2
  const blueEndAngleDeg = 90
  const angleRad = (blueEndAngleDeg * Math.PI) / 180
  const ballLeft = inset + ringSize / 2 + Math.cos(angleRad) * radius - ballSize / 2
  const ballTop = inset + ringSize / 2 + Math.sin(angleRad) * radius - ballSize / 2
  const ringMask = cutoutColor
    ? {}
    : {
        WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${strokeInner}px), #000 calc(100% - ${strokeInner}px))`,
        mask: `radial-gradient(farthest-side, transparent calc(100% - ${strokeInner}px), #000 calc(100% - ${strokeInner}px))`,
      }

  return (
    <div
      className={`relative inline-block animate-spin overflow-hidden ${className}`}
      style={{
        animationDuration: '1.6s',
        width: `${size}px`,
        height: `${size}px`,
      }}
      aria-label="Cargando"
      role="status"
    >
      <div
        className="absolute rounded-full"
        style={{
          width: `${ringSize}px`,
          height: `${ringSize}px`,
          left: `${inset}px`,
          top: `${inset}px`,
          background: `conic-gradient(from 180deg, #FFFFFF 0%, ${middleColor} 50%, #232D4F 100%)`,
          ...ringMask,
        }}
      >
        {cutoutColor ? (
          <div
            className="absolute rounded-full"
            style={{
              inset: `${strokeInner}px`,
              backgroundColor: cutoutColor,
            }}
          />
        ) : null}
      </div>
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
