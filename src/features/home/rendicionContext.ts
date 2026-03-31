import type { SpaceItem } from '../../api/spacesApi'

export interface RendicionProjectContext {
  organizationId: number
  organizationName: string
  projectKey: string
  projectLabel: string
  projectCode: string | null
  representativeSpace: SpaceItem
  spaces: SpaceItem[]
}

function normalizeProjectCode(value: string | null | undefined): string {
  return String(value || '').trim()
}

export function buildRendicionProjectContexts(spaces: SpaceItem[]): RendicionProjectContext[] {
  const grouped = new Map<string, RendicionProjectContext>()

  for (const space of spaces) {
    if (!space.organizacion_id || !space.organizacion__nombre) {
      continue
    }

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
      representativeSpace: space,
      spaces: [space],
    })
  }

  return [...grouped.values()].sort((left, right) => {
    const organizationCompare = left.organizationName.localeCompare(right.organizationName)
    if (organizationCompare !== 0) {
      return organizationCompare
    }
    return left.projectLabel.localeCompare(right.projectLabel)
  })
}
