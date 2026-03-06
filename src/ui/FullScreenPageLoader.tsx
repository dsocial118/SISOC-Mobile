import AppLoadingSpinner from './AppLoadingSpinner'
import { SafeScreen } from './SafeScreen'

export function FullScreenPageLoader() {
  return (
    <SafeScreen
      fixed
      className="flex items-center justify-center bg-[linear-gradient(180deg,#232D4F_20%,#E7BA61_80%)]"
    >
      <div className="flex flex-col items-center justify-center gap-3 text-white">
        <AppLoadingSpinner size={96} />
        <p className="text-center text-[15px] font-semibold tracking-[0.02em]">
          Cargando tu información
        </p>
      </div>
    </SafeScreen>
  )
}

