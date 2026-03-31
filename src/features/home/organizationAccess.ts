import type { SpaceItem } from '../../api/spacesApi'

export interface OrganizationSpaceGroup {
  organizationId: number
  organizationName: string
  spaces: SpaceItem[]
}

export interface OrganizationAccessSummary {
  organizationGroups: OrganizationSpaceGroup[]
  extraDirectSpaces: SpaceItem[]
  hasOrganizationAssociation: boolean
  isDirectSpaceAssociation: boolean
  autoEnterSpace: SpaceItem | null
}

function sortSpacesByName(spaces: SpaceItem[]): SpaceItem[] {
  return [...spaces].sort((left, right) => left.nombre.localeCompare(right.nombre))
}

export function buildOrganizationAccessSummary(spaces: SpaceItem[]): OrganizationAccessSummary {
  const sortedSpaces = sortSpacesByName(spaces)
  const groupsMap = new Map<number, OrganizationSpaceGroup>()
  const extraDirectSpaces: SpaceItem[] = []

  for (const space of sortedSpaces) {
    const organizationId = space.organizacion_id ?? null
    const organizationName = space.organizacion__nombre ?? null
    const hasOrganizationData = Boolean(organizationId && organizationName)

    if (space.tipo_asociacion !== 'espacio' && hasOrganizationData) {
      const existingGroup = groupsMap.get(organizationId as number)
      if (existingGroup) {
        existingGroup.spaces.push(space)
        continue
      }
      groupsMap.set(organizationId as number, {
        organizationId: organizationId as number,
        organizationName: organizationName as string,
        spaces: [space],
      })
      continue
    }

    if (space.tipo_asociacion === 'espacio' || !hasOrganizationData) {
      extraDirectSpaces.push(space)
    }
  }

  const organizationGroups = [...groupsMap.values()].sort((left, right) =>
    left.organizationName.localeCompare(right.organizationName),
  )
  const hasOrganizationAssociation = organizationGroups.length > 0
  const isDirectSpaceAssociation = !hasOrganizationAssociation && extraDirectSpaces.length > 0

  let autoEnterSpace: SpaceItem | null = null
  if (sortedSpaces.length === 1) {
    autoEnterSpace = sortedSpaces[0]
  } else if (
    organizationGroups.length === 1
    && organizationGroups[0].spaces.length === 1
    && extraDirectSpaces.length === 0
  ) {
    autoEnterSpace = organizationGroups[0].spaces[0]
  }

  return {
    organizationGroups,
    extraDirectSpaces,
    hasOrganizationAssociation,
    isDirectSpaceAssociation,
    autoEnterSpace,
  }
}
