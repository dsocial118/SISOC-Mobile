import { useNavigate } from 'react-router-dom'
import inicioImage from '../assets/images/inicio.png'
import { getHomePathForRole } from '../auth/roleRouting'
import { useAuth } from '../auth/useAuth'
import { InstallPwaModal } from '../pwa/InstallPwaModal'
import { AppLoadingSpinner } from '../ui/AppLoadingSpinner'
import { LargeBlueButton } from '../ui/buttons'
import { SafeScreen } from '../ui/SafeScreen'

export function PreLoginPage() {
  const navigate = useNavigate()
  const { role, isAuthenticated, isLoading, sessionStatus } = useAuth()

  function handleEnter() {
    const hasValidSession = isAuthenticated && sessionStatus !== 'reauth'
    if (hasValidSession && role) {
      navigate(getHomePathForRole(role))
      return
    }

    navigate('/login')
  }

  return (
    <SafeScreen
      fixed
      className="h-[100dvh] w-full overflow-hidden overscroll-none bg-[linear-gradient(to_bottom,_#232D4F_0%,_#232D4F_22%,_#E7BA61_78%,_#E7BA61_100%)]"
    >
      <InstallPwaModal />
      <section className="relative flex h-full w-full items-center justify-center">
        <div className="mt-[4svh] flex flex-col items-center">
          <div className="relative w-full max-w-[340px]">
            <img
              src={inicioImage}
              alt="Mi espacio - App de SiSoC"
              className="h-auto w-full object-contain"
              draggable={false}
            />
            <div className="absolute inset-0 flex translate-y-3 flex-col items-center justify-center text-white">
              <h1 className="text-left text-[40px] font-extrabold leading-[0.95] text-white">
                Mi
                <br />
                espacio
              </h1>
              <p className="mt-3 w-full translate-x-2 text-center text-[16px] font-extrabold leading-none text-white">
                App de SiSoC
              </p>
            </div>
          </div>
          <LargeBlueButton
            onClick={handleEnter}
            disabled={isLoading}
            className="mx-[10px] my-[30px] h-[47px] w-[139px] rounded-[20px] text-[18px] leading-none"
          >
            {isLoading ? 'Cargando...' : 'Ingresar'}
          </LargeBlueButton>
          {isLoading ? (
            <div className="-mt-6 flex flex-col items-center gap-2 text-white">
              <AppLoadingSpinner size={56} />
              <p className="text-[13px] font-semibold">Cargando tu información</p>
            </div>
          ) : null}
        </div>
      </section>
    </SafeScreen>
  )
}

