import { useEffect, useMemo, useState } from 'react'
import type { AxiosError } from 'axios'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronLeft,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import { listMySpaces, type SpaceItem } from '../../api/spacesApi'
import { useAuth } from '../../auth/useAuth'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'

export function OrganizationHomePage() {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const { setPageLoading } = usePageLoading()
  const { isDark } = useAppTheme()
  const cacheKey = userProfile?.username || '__anonymous__'
  const initialCachedSpaces = getOrganizationSpacesCache(cacheKey)
  const hasCachedSpaces = initialCachedSpaces !== null
  const [spaces, setSpaces] = useState<SpaceItem[]>(initialCachedSpaces ?? [])
  const [loading, setLoading] = useState(!hasCachedSpaces)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchText, setSearchText] = useState('')
  const userDisplayName = (userProfile?.fullName || '').trim() || 'Usuario'

  useEffect(() => {
    let isMounted = true

    async function loadSpaces() {
      setPageLoading(!hasCachedSpaces)
      if (!hasCachedSpaces) {
        setLoading(true)
      }
      setErrorMessage('')
      try {
        const results = await listMySpaces()
        if (!isMounted) {
          return
        }
        setSpaces(results)
        setOrganizationSpacesCache(cacheKey, results)
      } catch (error) {
        if (!isMounted) {
          return
        }
        if (hasCachedSpaces) {
          return
        }
        const detail =
          (error as AxiosError<{ detail?: string }>)?.response?.data?.detail
          || 'No se pudieron cargar tus espacios.'
        setErrorMessage(detail)
      } finally {
        if (isMounted) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    }

    void loadSpaces()
    return () => {
      isMounted = false
      setPageLoading(false)
    }
  }, [cacheKey, hasCachedSpaces, setPageLoading])

  useEffect(() => {
    if (loading || errorMessage || spaces.length !== 1) {
      return
    }
    const singleSpace = spaces[0]
    navigate(`/app-org/espacios/${singleSpace.id}/hub`, {
      replace: true,
      state: { spaceName: singleSpace.nombre, fromSingleSpaceAuto: true },
    })
  }, [errorMessage, loading, navigate, spaces])

  function displayValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return 'Sin dato'
    }
    return String(value)
  }

  function formatStreetAndNumber(space: SpaceItem): string | null {
    const street = (space.calle || '').trim()
    const number = space.numero !== null && space.numero !== undefined ? String(space.numero) : ''
    if (!street && !number) {
      return null
    }
    if (street && number) {
      return `${street} ${number}`
    }
    return street || number
  }

  function normalizeSearchValue(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  const filteredSpaces = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchText)
    if (!normalizedSearch) {
      return spaces
    }

    return spaces.filter((space) => {
      const nombre = normalizeSearchValue(space.nombre)
      const provincia = normalizeSearchValue(space.provincia__nombre)
      return nombre.includes(normalizedSearch) || provincia.includes(normalizedSearch)
    })
  }, [searchText, spaces])

  return (
    <section>
      <div className={`mb-3 mt-1 ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
        <p className="text-[16px]">
          ¡Hola <strong>{userDisplayName}</strong>!
        </p>
        <p className="text-[14px]">¿Qué Espacio queres consultar?</p>
      </div>

      <div
        className="mb-[10px] mt-[10px] flex h-[44px] w-full items-center rounded-[15px] border px-3"
        style={{
          backgroundColor: isDark ? '#232D4F' : '#F5F5F5',
          borderColor: '#E7BA61',
        }}
      >
        <input
          type="text"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Buscar espacios"
          className="mr-2 h-full w-full border-none bg-transparent text-[12px] italic outline-none"
          style={{
            color: isDark ? '#F5F5F5' : '#555555',
          }}
        />
        <span className="flex h-8 w-8 items-center justify-center">
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            aria-hidden="true"
            style={{ fontSize: 20, color: '#232D4F' }}
          />
        </span>
      </div>

      {!loading && errorMessage ? (
        <div className="mt-6 rounded-xl border border-[#C62828]/20 bg-[#C62828]/10 p-4 text-sm text-[#C62828]">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && spaces.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          No tenes espacios asignados actualmente.
        </div>
      ) : null}

      {!loading && !errorMessage && filteredSpaces.length === 0 && spaces.length > 0 ? (
        <div className={`mt-6 rounded-2xl border p-5 text-sm ${isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
          No hay resultados para la búsqueda.
        </div>
      ) : null}

      {!loading && !errorMessage && filteredSpaces.length > 0 ? (
        <div className="grid gap-4">
          {filteredSpaces.map((space, index) => (
            <button
              key={space.id}
              type="button"
              onClick={() =>
                navigate(`/app-org/espacios/${space.id}`, {
                  state: { spaceName: space.nombre },
                })
              }
              className="progressive-card relative rounded-[15px] border p-5 pr-14 text-left shadow-sm transition hover:border-[#232D4F] hover:shadow-md"
              style={{
                backgroundColor: isDark ? '#232D4F' : '#F5F5F5',
                borderColor: '#E0E0E0',
                boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.25)',
                ['--card-delay' as string]: `${index * 70}ms`,
              }}
            >
              <div className={`flex items-start gap-3 border-b pb-3 pr-16 ${isDark ? 'border-white/25' : 'border-slate-200'}`}>
                <h3 className={`text-[16px] font-medium ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>{displayValue(space.nombre)}</h3>
              </div>

              <span
                className={`absolute right-4 top-5 rounded-full px-2 py-1 text-[10px] font-semibold ${
                  isDark
                    ? 'border border-[#E0E0E0] bg-white/10 text-white'
                    : 'bg-[#232D4F] text-white'
                }`}
              >
                {displayValue(
                  space.ultimo_estado__estado_general__estado_proceso__estado
                  || space.ultimo_estado__estado_general__estado_proceso,
                )}
              </span>

              <span
                className={`absolute right-4 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center ${
                  isDark ? 'text-white' : 'text-[#232D4F]'
                }`}
              >
                <FontAwesomeIcon
                  icon={faChevronLeft}
                  aria-hidden="true"
                  style={{ fontSize: 22, transform: 'rotate(180deg)' }}
                />
              </span>

              <div className={`mt-3 space-y-1.5 text-sm ${isDark ? 'text-white' : 'text-slate-700'}`}>
                <p>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Estado actividad:</span>{' '}
                  {displayValue(space.ultimo_estado__estado_general__estado_actividad__estado)}
                </p>
                <p>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Estado detalle:</span>{' '}
                  {displayValue(
                    space.ultimo_estado__estado_general__estado_detalle__estado
                    || space.ultimo_estado__estado_general__estado_detalle,
                  )}
                </p>
                <p>
                  <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Provincia:</span>{' '}
                  {displayValue(space.provincia__nombre)}
                </p>
                {formatStreetAndNumber(space) ? (
                  <p>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Calle:</span>{' '}
                    {formatStreetAndNumber(space)}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

