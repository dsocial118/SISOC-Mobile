import { useNavigate } from 'react-router-dom'
import inicioImage from '../assets/images/inicio.png'
import { getHomePathForRole } from './roleRouting'
import { useAuth } from './useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { role } = useAuth()

  function handleEnter() {
    if (role) {
      navigate(getHomePathForRole(role), { replace: true })
      return
    }

    navigate('/login/form')
  }

  return (
    <main
      className="flex min-h-[100svh] w-full items-center justify-center bg-[linear-gradient(180deg,#232D4F_20%,#E7BA61_80%)]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      <section className="flex min-h-[100svh] w-full max-w-md flex-col items-center justify-center px-6 py-10">
        <img
          src={inicioImage}
          alt=""
          className="w-full max-w-[320px] object-contain"
          draggable={false}
        />

        <button
          type="button"
          onClick={handleEnter}
          className="mt-8 flex h-[47px] w-[139px] items-center justify-center rounded-[20px] bg-[#232D4F] text-[18px] font-semibold text-white shadow-[4px_4px_4px_rgba(0,0,0,0.25)]"
        >
          Ingresar
        </button>
      </section>
    </main>
  )
}
