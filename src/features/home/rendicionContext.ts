import type { SpaceItem } from '../../api/spacesApi'

export interface RendicionProjectContext {
  organizationId: number
  organizationName: string
  projectKey: string
  projectLabel: string
  projectCode: string | null
  projectId: number | null
  representativeSpace: SpaceItem
  spaces: SpaceItem[]
}

function normalizeProjectCode(value: string | null | undefined): string {
  return String(value || '').trim()
}

export function buildRendicionProjectContexts(spaces: SpaceItem[]): RendicionProjectContext[] {
  const grouped = new Map<string, RendicionProjectContext>()
  const organizations = new Map<number, SpaceItem[]>()
  for (const space of spaces) {
    if (!space.organizacion_id || !space.organizacion__nombre) {
      continue
    }
    const organizationSpaces = organizations.get(space.organizacion_id) || []
    organizationSpaces.push(space)
    organizations.set(space.organizacion_id, organizationSpaces)
  }

  for (const [organizationId, organizationSpaces] of organizations) {
    const firstSpace = organizationSpaces[0]
    const projects = new Map<number, { id: number; codigo: string; nombre?: string | null }>()
    for (const space of organizationSpaces) {
      for (const project of space.organizacion_proyectos || []) {
        projects.set(project.id, project)
      }
    }

    if (projects.size > 0) {
      for (const project of projects.values()) {
        const representativeSpace = organizationSpaces.find(
          (space) => space.proyecto_id === project.id || normalizeProjectCode(space.codigo_de_proyecto) === project.codigo,
        ) || firstSpace
        grouped.set(`${organizationId}:project:${project.id}`, {
          organizationId,
          organizationName: firstSpace.organizacion__nombre || '',
          projectKey: `project:${project.id}`,
          projectLabel: project.codigo,
          projectCode: project.codigo,
          projectId: project.id,
          representativeSpace,
          spaces: organizationSpaces.filter(
            (space) => space.proyecto_id === project.id || normalizeProjectCode(space.codigo_de_proyecto) === project.codigo,
          ),
        })
      }
      continue
    }

    for (const space of organizationSpaces) {
    const projectCode = normalizeProjectCode(space.codigo_de_proyecto)
    const projectKey = projectCode || `space:${space.id}`
    const groupKey = `${space.organizacion_id}:${projectKey}`
    const existing = grouped.get(groupKey)

    if (existing) {
      existing.spaces.push(space)
      continue
    }

    grouped.set(groupKey, {
      organizationId: space.organizacion_id,
      organizationName: space.organizacion__nombre,
      projectKey,
      projectLabel: projectCode || `Sin proyecto (${space.nombre})`,
      projectCode: projectCode || null,
      projectId: space.proyecto_id || null,
      representativeSpace: space,
      spaces: [space],
    })
    }
  }

  return [...grouped.values()].sort((left, right) => {
    const organizationCompare = left.organizationName.localeCompare(right.organizationName)
    if (organizationCompare !== 0) {
      return organizationCompare
    }
    return left.projectLabel.localeCompare(right.projectLabel)
  })
}
