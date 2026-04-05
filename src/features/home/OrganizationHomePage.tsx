import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faChevronRight,
  faFilter,
  faMagnifyingGlass,
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import { listMySpaces, type SpaceItem } from '../../api/spacesApi'
import { useAuth } from '../../auth/useAuth'
import { parseApiError } from '../../api/errorUtils'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/theme'
import { buildOrganizationAccessSummary } from './organizationAccess'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'

type FilterOption = {
  value: string
  label: string
}

function displayValue(value: string | number | null | undefined, fallback = 'Sin dato'): string {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  return String(value)
}

function normalizeSearchValue(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buildOptions(items: Array<{ value: string; label: string }>): FilterOption[] {
  return items
    .filter((item) => item.value && item.label)
    .sort((a, b) => a.label.localeCompare(b.label))
    .filter((item, index, array) => array.findIndex((candidate) => candidate.value === item.value) === index)
}

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
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('')
  const [selectedProjectCode, setSelectedProjectCode] = useState('')
  const [openOrganizations, setOpenOrganizations] = useState<Record<string, boolean>>({})

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
        setErrorMessage(parseApiError(error, 'No se pudieron cargar tus espacios.'))
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

  const accessSummary = useMemo(() => buildOrganizationAccessSummary(spaces), [spaces])
  const hasOrganizationAssociation = accessSummary.hasOrganizationAssociation
  const isDirectSpaceAssociation = accessSummary.isDirectSpaceAssociation

  const programOptions = useMemo(
    () =>
      buildOptions(
        spaces.map((space) => ({
          value: String(space.programa_id || ''),
          label: String(space.programa__nombre || ''),
        })),
      ),
    [spaces],
  )

  const organizationOptions = useMemo(() => {
    const source = selectedProgramId
      ? spaces.filter((space) => String(space.programa_id || '') === selectedProgramId)
      : spaces
    return buildOptions(
      source.map((space) => ({
        value: String(space.organizacion_id || ''),
        label: String(space.organizacion__nombre || ''),
      })),
    )
  }, [selectedProgramId, spaces])

  const projectOptions = useMemo(() => {
    const source = spaces.filter((space) => {
      if (selectedProgramId && String(space.programa_id || '') !== selectedProgramId) {
        return false
      }
      if (selectedOrganizationId && String(space.organizacion_id || '') !== selectedOrganizationId) {
        return false
      }
      return true
    })
    return buildOptions(
      source.map((space) => ({
        value: String(space.codigo_de_proyecto || ''),
        label: String(space.codigo_de_proyecto || ''),
      })),
    )
  }, [selectedOrganizationId, selectedProgramId, spaces])

  useEffect(() => {
    if (!hasOrganizationAssociation) {
      return
    }

    const validProgramIds = new Set(programOptions.map((item) => item.value))
    if (selectedProgramId && !validProgramIds.has(selectedProgramId)) {
      setSelectedProgramId('')
    }
  }, [hasOrganizationAssociation, programOptions, selectedProgramId])

  useEffect(() => {
    if (!hasOrganizationAssociation) {
      return
    }

    const validOrganizationIds = new Set(organizationOptions.map((item) => item.value))
    if (selectedOrganizationId && !validOrganizationIds.has(selectedOrganizationId)) {
      setSelectedOrganizationId('')
    }
  }, [hasOrganizationAssociation, organizationOptions, selectedOrganizationId])

  useEffect(() => {
    if (!hasOrganizationAssociation) {
      return
    }

    const validProjectCodes = new Set(projectOptions.map((item) => item.value))
    if (selectedProjectCode && !validProjectCodes.has(selectedProjectCode)) {
      setSelectedProjectCode('')
    }
  }, [hasOrganizationAssociation, projectOptions, selectedProjectCode])

  const filteredSpaces = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(searchText)
    return [...spaces]
      .filter((space) => {
        if (selectedProgramId && String(space.programa_id || '') !== selectedProgramId) {
          return false
        }
        if (selectedOrganizationId && String(space.organizacion_id || '') !== selectedOrganizationId) {
          return false
        }
        if (selectedProjectCode && String(space.codigo_de_proyecto || '') !== selectedProjectCode) {
          return false
        }
        if (!normalizedSearch) {
          return true
        }
        const searchableValues = [
          space.nombre,
          space.provincia__nombre,
          space.localidad__nombre,
          space.organizacion__nombre,
          space.codigo_de_proyecto,
          space.programa__nombre,
        ]
        return searchableValues.some((value) =>
          normalizeSearchValue(value).includes(normalizedSearch),
        )
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [
    searchText,
    selectedOrganizationId,
    selectedProgramId,
    selectedProjectCode,
    spaces,
  ])

  const filteredAccessSummary = useMemo(
    () => buildOrganizationAccessSummary(filteredSpaces),
    [filteredSpaces],
  )

  useEffect(() => {
    setOpenOrganizations((current) => {
      const nextState: Record<string, boolean> = {}
      filteredAccessSummary.organizationGroups.forEach((group) => {
        nextState[group.organizationId] = current[group.organizationId] ?? true
      })
      return nextState
    })
  }, [filteredAccessSummary.organizationGroups])

  useEffect(() => {
    if (loading || errorMessage || !accessSummary.autoEnterSpace) {
      return
    }
    const singleSpace = accessSummary.autoEnterSpace
    navigate(`/app-org/espacios/${singleSpace.id}/hub`, {
      replace: true,
      state: {
        spaceName: singleSpace.nombre,
        programName: singleSpace.programa__nombre || '',
        fromSingleSpaceAuto: true,
      },
    })
  }, [accessSummary.autoEnterSpace, errorMessage, loading, navigate])

  return (
    <section className="grid gap-4">
      <div
        className={`rounded-[18px] border p-4 ${
          isDark ? 'border-white/20 bg-[#232D4F] text-white' : 'border-[#E0E0E0] bg-[#F5F5F5] text-[#232D4F]'
        }`}
        style={{ boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.25)' }}
      >
        <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#E7BA61]">
          <FontAwesomeIcon icon={faFilter} aria-hidden="true" />
          Filtros
        </div>

        <div className="grid gap-3">
          <div
            className="flex h-[44px] w-full items-center rounded-[15px] border px-3"
            style={{
              backgroundColor: isDark ? '#1E2A47' : '#FFFFFF',
              borderColor: '#E7BA61',
            }}
          >
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Buscar por nombre, provincia o localidad"
              className="mr-2 h-full w-full border-none bg-transparent text-[12px] italic outline-none"
              style={{ color: isDark ? '#F5F5F5' : '#555555' }}
            />
            <span className="flex h-8 w-8 items-center justify-center">
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                aria-hidden="true"
                style={{ fontSize: 18, color: isDark ? '#F5F5F5' : '#232D4F' }}
              />
            </span>
          </div>

          {hasOrganizationAssociation ? (
            <>
              <select
                value={selectedProgramId}
                onChange={(event) => setSelectedProgramId(event.target.value)}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${
                  isDark
                    ? 'border-white/20 bg-[#1E2A47] text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <option value="">Todos los programas</option>
                {programOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedOrganizationId}
                onChange={(event) => setSelectedOrganizationId(event.target.value)}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${
                  isDark
                    ? 'border-white/20 bg-[#1E2A47] text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <option value="">Todas las organizaciones</option>
                {organizationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedProjectCode}
                onChange={(event) => setSelectedProjectCode(event.target.value)}
                className={`rounded-xl border px-3 py-2 text-sm outline-none ${
                  isDark
                    ? 'border-white/20 bg-[#1E2A47] text-white'
                    : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <option value="">Todos los proyectos</option>
                {projectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {!hasOrganizationAssociation && isDirectSpaceAssociation ? (
            <p className={`text-[12px] ${isDark ? 'text-white/75' : 'text-slate-600'}`}>
              Usuario vinculado directamente a espacios.
            </p>
          ) : null}
        </div>
      </div>

      {!loading && errorMessage ? (
        <div className="rounded-xl border border-[#C62828]/20 bg-[#C62828]/10 p-4 text-sm text-[#C62828]">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && spaces.length === 0 ? (
        <div
          className={`rounded-2xl border p-5 text-sm ${
            isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          Tu usuario no posee espacios configurados en SISOC Web. No es posible continuar hasta regularizar la configuración.
        </div>
      ) : null}

      {!loading && !errorMessage && filteredSpaces.length === 0 && spaces.length > 0 ? (
        <div
          className={`rounded-2xl border p-5 text-sm ${
            isDark ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          No hay espacios para los filtros seleccionados.
        </div>
      ) : null}

      {!loading && !errorMessage && filteredSpaces.length > 0 ? (
        <section
          className={`rounded-[18px] border p-4 ${
            isDark ? 'border-white/15 bg-[#232D4F] text-white' : 'border-[#E0E0E0] bg-[#F5F5F5] text-[#232D4F]'
          }`}
          style={{ boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.16)' }}
        >
          <div className="mb-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#E7BA61]">
              Organizaciones
            </p>
          </div>

          <div className="grid gap-3">
            {filteredAccessSummary.organizationGroups.map((group) => {
              const isOpen = openOrganizations[group.organizationId] ?? true
              return (
                <div
                  key={group.organizationId}
                  className={`overflow-hidden rounded-[16px] border ${
                    isDark ? 'border-white/15 bg-[#1E2A47]' : 'border-[#D9D9D9] bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenOrganizations((current) => ({
                        ...current,
                        [group.organizationId]: !isOpen,
                      }))
                    }
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-[15px] font-semibold">{group.organizationName}</p>
                      <p className={`mt-1 text-[12px] ${isDark ? 'text-white/70' : 'text-slate-500'}`}>
                        {group.spaces.length} espacio{group.spaces.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <FontAwesomeIcon
                      icon={isOpen ? faChevronDown : faChevronRight}
                      aria-hidden="true"
                      className={isDark ? 'text-white/75' : 'text-slate-500'}
                    />
                  </button>

                  {isOpen ? (
                    <div className="grid gap-3 border-t border-black/10 px-3 py-3">
                      {group.spaces.map((space, index) => (
                        <SpaceCard
                          key={space.id}
                          space={space}
                          index={index}
                          isDark={isDark}
                          showProgramMeta
                          onOpen={() =>
                            navigate(`/app-org/espacios/${space.id}/hub`, {
                              state: {
                                spaceName: space.nombre,
                                programName: space.programa__nombre || '',
                              },
                            })
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {filteredAccessSummary.extraDirectSpaces.length > 0 ? (
              <div
                className={`overflow-hidden rounded-[16px] border ${
                  isDark ? 'border-white/15 bg-[#1E2A47]' : 'border-[#D9D9D9] bg-white'
                }`}
              >
                <div className="px-4 py-3">
                  <p className="text-[15px] font-semibold">Espacios directos</p>
                </div>
                <div className="grid gap-3 border-t border-black/10 px-3 py-3">
                  {filteredAccessSummary.extraDirectSpaces.map((space, index) => (
                    <SpaceCard
                      key={space.id}
                      space={space}
                      index={index}
                      isDark={isDark}
                      showProgramMeta={hasOrganizationAssociation}
                      onOpen={() =>
                        navigate(`/app-org/espacios/${space.id}/hub`, {
                          state: {
                            spaceName: space.nombre,
                            programName: space.programa__nombre || '',
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </section>
  )
}

function SpaceCard({
  space,
  index,
  isDark,
  onOpen,
  showProgramMeta,
}: {
  space: SpaceItem
  index: number
  isDark: boolean
  onOpen: () => void
  showProgramMeta: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="progressive-card rounded-[15px] border p-4 text-left transition hover:border-[#232D4F]"
      style={{
        backgroundColor: isDark ? '#16213C' : '#FFFFFF',
        borderColor: '#E0E0E0',
        boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.18)',
        ['--card-delay' as string]: `${index * 70}ms`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-[16px] font-medium ${isDark ? 'text-white' : 'text-[#232D4F]'}`}>
            {displayValue(space.nombre)}
          </h3>
          {showProgramMeta ? (
            <p className={`mt-1 text-[11px] ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
              {displayValue(space.programa__nombre)} · {displayValue(space.codigo_de_proyecto)}
            </p>
          ) : null}
        </div>
        <FontAwesomeIcon
          icon={faChevronRight}
          aria-hidden="true"
          className={isDark ? 'text-white/80' : 'text-slate-500'}
          style={{ fontSize: 14 }}
        />
      </div>

      <div className={`mt-3 grid gap-1.5 text-sm ${isDark ? 'text-white' : 'text-slate-700'}`}>
        <p>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Estado actividad:</span>{' '}
          {displayValue(space.ultimo_estado__estado_general__estado_actividad__estado)}
        </p>
        <p>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Estado proceso:</span>{' '}
          {displayValue(space.ultimo_estado__estado_general__estado_proceso__estado)}
        </p>
        <p>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Provincia:</span>{' '}
          {displayValue(space.provincia__nombre)}
        </p>
        <p>
          <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Localidad:</span>{' '}
          {displayValue(space.localidad__nombre)}
        </p>
      </div>
    </button>
  )
}
