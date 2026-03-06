import { useEffect, useState } from 'react'
import type { AxiosError } from 'axios'
import { useParams } from 'react-router-dom'
import { getSpaceDetail } from '../../api/spacesApi'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

export function SpaceModulePlaceholderPage({ moduleTitle }: { moduleTitle: string }) {
  const { spaceId } = useParams<{ spaceId: string }>()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function validateSpace() {
      setPageLoading(true)
      if (!spaceId) {
        setErrorMessage('No se encontro el espacio seleccionado.')
        setPageLoading(false)
        return
      }
      try {
        await getSpaceDetail(spaceId)
      } catch (error) {
        if (!isMounted) {
          return
        }
        const detail =
          (error as AxiosError<{ detail?: string }>)?.response?.data?.detail
          || 'No se pudo validar el espacio para operar.'
        setErrorMessage(detail)
      } finally {
        if (isMounted) {
          setPageLoading(false)
        }
      }
    }

    void validateSpace()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [setPageLoading, spaceId])

  if (errorMessage) {
    return (
      <section>
        <div className="mt-4 rounded-xl border border-[#C62828]/20 bg-[#C62828]/10 p-4 text-sm text-[#C62828]">
          {errorMessage}
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className={`progressive-card rounded-2xl border p-5 ${isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
        <h2 className={`text-[16px] font-semibold ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
          {moduleTitle}
        </h2>
        <p className="mt-2 text-sm">Módulo en construcción.</p>
      </div>
    </section>
  )
}
