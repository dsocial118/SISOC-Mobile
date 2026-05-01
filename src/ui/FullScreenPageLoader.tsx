import AppLoadingSpinner from './AppLoadingSpinner'
import { SafeScreen } from './SafeScreen'

export function FullScreenPageLoader() {
  return (
    <SafeScreen fixed className="bg-[#3E5A7E]">
      <section className="mx-auto flex min-h-[100dvh] w-full max-w-4xl items-center justify-center px-4">
        <div className="pt-1 text-center text-white">
          <div className="flex justify-center">
            <AppLoadingSpinner size={42} />
          </div>
          <p className="mt-2 text-[13px] font-semibold">Cargando tu información</p>
        </div>
      </section>
    </SafeScreen>
  )
}
