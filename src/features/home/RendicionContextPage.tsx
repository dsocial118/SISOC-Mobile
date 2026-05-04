import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBuilding,
  faCalendarDay,
  faChevronRight,
  faDiagramProject,
  faFolderOpen,
} from '@fortawesome/free-solid-svg-icons'
import { useNavigate } from 'react-router-dom'
import { parseApiError } from '../../api/errorUtils'
import type { RendicionItem } from '../../api/rendicionApi'
import { listMySpaces } from '../../api/spacesApi'
import { useAuth } from '../../auth/useAuth'
import { syncNow } from '../../sync/engine'
import { AppLoadingSpinner } from '../../ui/AppLoadingSpinner'
import { usePageLoading } from '../../ui/PageLoadingContext'
import { useAppTheme } from '../../ui/ThemeContext'
import {
  getOrganizationSpacesCache,
  setOrganizationSpacesCache,
} from './organizationSpacesCache'
import {
  buildRendicionProjectContexts,
  type RendicionProjectContext,
} from './rendicionContext'
import { loadRendicionesOfflineFirst } from './rendicionOffline'
import { getRendicionHubCache, setRendicionHubCache } from './rendicionViewCache'

interface RendicionContextListItem {
  context: RendicionProjectContext
  rendiciones: RendicionItem[]
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function getStatusClasses(status: string, isDark: boolean): string {
  if (status === 'revision') {
    return isDark
      ? 'bg-[#E7BA61]/20 text-[#F7D58D]'
      : 'bg-[#FFF4D6] text-[#8C6A1D]'
  }
  if (status === 'finalizada') {
    return isDark
      ? 'bg-[#2E7D33]/20 text-[#A5D6A7]'
      : 'bg-[#E8F5E9] text-[#2E7D33]'
  }
  if (status === 'subsanar') {
    return isDark
      ? 'bg-[#C62828]/20 text-[#FFCDD2]'
      : 'bg-[#FDECEC] text-[#C62828]'
  }
  return isDark
    ? 'bg-white/10 text-white'
    : 'bg-[#EEF2FF] text-[#232D4F]'
}

function buildRouteState(context: RendicionProjectContext) {
  return {
    organizationName: context.organizationName,
    projectName: context.projectLabel,
    programName: context.projectLabel,
    spaceName: context.representativeSpace.nombre,
  }
}

function RendicionesSkeleton({ isDark }: { isDark: boolean }) {
  const cardBg = isDark ? 'bg-white/10 border-white/20' : 'bg-white border-slate-200'
  const barColor = isDark ? 'bg-white/35' : 'bg-slate-200'
  const textColor = isDark ? 'text-white' : 'text-[#232D4F]'

  return (
    <section className="space-y-2">
      {Array.from({ length: 1 }).map((_, index) => (
        <div
          key={index}
          className={`rounded-[18px] border p-4 shadow-sm ${cardBg}`}
        >
          <div className={`skeleton-shimmer h-3 w-24 rounded-full ${barColor}`} />
          <div className={`mt-2 skeleton-shimmer h-4 w-36 rounded-full ${barColor}`} />
          <div className={`mt-3 skeleton-shimmer h-3 w-40 rounded-full ${barColor}`} />
          <div className={`mt-3 skeleton-shimmer h-6 w-28 rounded-full ${barColor}`} />
        </div>
      ))}
      <div className={`pt-0.5 text-center ${textColor}`}>
        <div className="flex justify-center">
          <AppLoadingSpinner size={42} />
        </div>
        <p className="mt-1 text-[13px] font-semibold">Cargando rendiciones</p>
      </div>
    </section>
  )
}

export function RendicionContextPage() {
  const navigate = useNavigate()
  const { userProfile } = useAuth()
  const { isDark } = useAppTheme()
  const { setPageLoading } = usePageLoading()
  const cacheKey = userProfile?.username || '__anonymous__'
  const hubCache = getRendicionHubCache(cacheKey)
  const initialCachedSpaces = getOrganizationSpacesCache(cacheKey)
  const hasCachedSpaces = initialCachedSpaces !== null

  const [spaces, setSpaces] = useState(initialCachedSpaces ?? [])
  const [loading, setLoading] = useState(!hasCachedSpaces)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    hubCache?.selectedOrganizationId ?? '',
  )
  const [selectedProjectKey, setSelectedProjectKey] = useState(
    hubCache?.selectedProjectKey ?? '',
  )
  const [existingLoading, setExistingLoading] = useState(!hubCache)
  const [existingError, setExistingError] = useState('')
  const [existingRendiciones, setExistingRendiciones] = useState<RendicionContextListItem[]>(
    hubCache?.items ?? [],
  )

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
        if (!hasCachedSpaces) {
          setErrorMessage(
            parseApiError(error, 'No se pudieron cargar los contextos de rendición.'),
          )
        }
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

  const contexts = useMemo(() => buildRendicionProjectContexts(spaces), [spaces])
  const organizationOptions = useMemo(
    () =>
      contexts
        .map((item) => ({
          value: String(item.organizationId),
          label: item.organizationName,
        }))
        .filter(
          (item, index, array) =>
            array.findIndex((candidate) => candidate.value === item.value) === index,
        ),
    [contexts],
  )

  const availableProjects = useMemo(() => {
    if (!selectedOrganizationId) {
      return []
    }
    return contexts.filter((item) => String(item.organizationId) === selectedOrganizationId)
  }, [contexts, selectedOrganizationId])

  useEffect(() => {
    if (!selectedOrganizationId && organizationOptions.length === 1) {
      setSelectedOrganizationId(organizationOptions[0].value)
    }
  }, [organizationOptions, selectedOrganizationId])

  useEffect(() => {
    if (!selectedOrganizationId) {
      if (selectedProjectKey) {
        setSelectedProjectKey('')
      }
      return
    }

    const stillValid = availableProjects.some((item) => item.projectKey === selectedProjectKey)
    if (!stillValid) {
      setSelectedProjectKey(availableProjects.length === 1 ? availableProjects[0].projectKey : '')
    }
  }, [availableProjects, selectedOrganizationId, selectedProjectKey])

  const selectedContext = useMemo(
    () => availableProjects.find((item) => item.projectKey === selectedProjectKey) ?? null,
    [availableProjects, selectedProjectKey],
  )

  useEffect(() => {
    let isMounted = true

    async function loadExistingRendiciones() {
      if (contexts.length === 0) {
        setExistingRendiciones([])
        setExistingError('')
        setExistingLoading(false)
        return
      }

      setExistingLoading(true)
      setExistingError('')
      try {
        const results = await Promise.all(
          contexts.map(async (context) => ({
            context,
            rendiciones: await loadRendicionesOfflineFirst(context.representativeSpace.id),
          })),
        )
        if (!isMounted) {
          return
        }
        const filteredResults = results.filter((item) => item.rendiciones.length > 0)
        setExistingRendiciones(filteredResults)
        setRendicionHubCache(cacheKey, {
          items: filteredResults,
          selectedOrganizationId,
          selectedProjectKey,
        })
      } catch (error) {
        if (!isMounted) {
          return
        }
        setExistingRendiciones([])
        setExistingError(
          parseApiError(error, 'No se pudieron cargar las rendiciones existentes.'),
        )
      } finally {
        if (isMounted) {
          setExistingLoading(false)
        }
      }
    }

    void loadExistingRendiciones()
    return () => {
      isMounted = false
    }
  }, [cacheKey, contexts, selectedOrganizationId, selectedProjectKey])

  useEffect(() => {
    void syncNow()
  }, [])

  useEffect(() => {
    setRendicionHubCache(cacheKey, {
      items: existingRendiciones,
      selectedOrganizationId,
      selectedProjectKey,
    })
  }, [cacheKey, existingRendiciones, selectedOrganizationId, selectedProjectKey])

  const titleClass = isDark ? 'text-white' : 'text-[#232D4F]'
  const subtitleClass = isDark ? 'text-white/80' : 'text-slate-600'
  const cardClass = isDark
    ? 'border-white/20 bg-[#232D4F] text-white'
    : 'border-[#E0E0E0] bg-[#F5F5F5] text-[#232D4F]'
  const inputClass = isDark
    ? 'border-white/20 bg-[#1E2A47] text-white'
    : 'border-slate-300 bg-white text-slate-700'

  function handleContinue() {
    if (!selectedContext) {
      return
    }
    navigate(`/app-org/espacios/${selectedContext.representativeSpace.id}/rendicion`, {
      state: buildRouteState(selectedContext),
    })
  }

  function handleOpenExisting(context: RendicionProjectContext, rendicionId: string | number) {
    navigate(`/app-org/espacios/${context.representativeSpace.id}/rendicion/${rendicionId}`, {
      state: buildRouteState(context),
    })
  }

  if (loading) {
    return null
  }

  if (errorMessage) {
    return (
      <section>
        <div className="mt-4 rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 p-4 text-sm text-white">
          {errorMessage}
        </div>
      </section>
    )
  }

  if (contexts.length === 0) {
    return (
      <section>
        <div className={`rounded-2xl border p-5 text-sm ${cardClass}`}>
          No hay organizaciones y proyectos disponibles para iniciar una rendición.
        </div>
      </section>
    )
  }

  return (
    <section className="grid gap-4 pb-24">
      <div className="grid gap-1 pt-2">
        <h2 className={`text-[16px] font-semibold ${titleClass}`}>Nueva rendición</h2>
      </div>

      <article
        className={`rounded-[18px] border p-4 ${cardClass}`}
        style={{ boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.25)' }}
      >
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span
              className={`inline-flex items-center gap-2 text-[12px] font-semibold ${titleClass}`}
            >
              <FontAwesomeIcon icon={faBuilding} aria-hidden="true" />
              Organización
            </span>
            <select
              value={selectedOrganizationId}
              onChange={(event) => setSelectedOrganizationId(event.target.value)}
              className={`rounded-xl border px-3 py-3 text-sm outline-none ${inputClass}`}
            >
              <option value="">Seleccioná una organización</option>
              {organizationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span
              className={`inline-flex items-center gap-2 text-[12px] font-semibold ${titleClass}`}
            >
              <FontAwesomeIcon icon={faDiagramProject} aria-hidden="true" />
              Proyecto
            </span>
            <select
              value={selectedProjectKey}
              onChange={(event) => setSelectedProjectKey(event.target.value)}
              disabled={!selectedOrganizationId}
              className={`rounded-xl border px-3 py-3 text-sm outline-none disabled:opacity-60 ${inputClass}`}
            >
              <option value="">Seleccioná un proyecto</option>
              {availableProjects.map((option) => (
                <option key={option.projectKey} value={option.projectKey}>
                  {option.projectLabel}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <button
        type="button"
        disabled={!selectedContext}
        onClick={handleContinue}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E7D33] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        Continuá
        <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
      </button>


      <div className="grid gap-1">
        <h2 className={`text-[16px] font-semibold ${titleClass}`}>Rendiciones creadas</h2>
      </div>

      {existingLoading ? (
        <RendicionesSkeleton isDark={isDark} />
      ) : existingError ? (
        <div className="rounded-xl border border-[#F2B8B5] bg-[#7A1C1C]/50 p-4 text-sm text-white">
          {existingError}
        </div>
      ) : existingRendiciones.length === 0 ? (
        <article
          className={`rounded-[18px] border p-5 text-center ${cardClass}`}
          style={{ boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.18)' }}
        >
          <FontAwesomeIcon
            icon={faFolderOpen}
            aria-hidden="true"
            className={subtitleClass}
            style={{ fontSize: 24 }}
          />
          <p className={`mt-3 text-sm ${subtitleClass}`}>
            Todavía no hay rendiciones cargadas.
          </p>
        </article>
      ) : (
        <div className="grid gap-3">
          {existingRendiciones.map(({ context, rendiciones }) =>
            rendiciones.map((row) => (
              <button
                key={`${context.organizationId}:${context.projectKey}:${row.id}`}
                type="button"
                onClick={() => handleOpenExisting(context, row.id)}
                className={`rounded-[18px] border p-4 text-left ${cardClass}`}
                style={{ boxShadow: '4px 4px 4px rgba(0, 0, 0, 0.18)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`mt-1 text-[15px] font-semibold ${titleClass}`}>
                      Rendición {row.numero_rendicion ?? row.id}
                    </p>
                    <p className={`mt-2 text-[12px] ${subtitleClass}`}>
                      Convenio: {row.convenio || 'Sin dato'}
                    </p>
                    <p
                      className={`mt-3 inline-flex items-center gap-2 text-[12px] ${subtitleClass}`}
                    >
                      <FontAwesomeIcon
                        icon={faCalendarDay}
                        aria-hidden="true"
                        style={{ fontSize: 11 }}
                      />
                      Creada el {formatDateTime(row.fecha_creacion)}
                    </p>
                    <p
                      className={`mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClasses(row.estado, isDark)}`}
                    >
                      {row.estado_label}
                    </p>
                  </div>
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    aria-hidden="true"
                    className={`shrink-0 self-center ${isDark ? 'text-white/80' : 'text-slate-500'}`}
                    style={{ fontSize: 14 }}
                  />
                </div>
              </button>
            )),
          )}
        </div>
      )}

    </section>
  )
}



