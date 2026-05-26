export type RendicionLineaProgramatica = 'secos' | 'tradicional'

export const RENDICION_LINEA_OPTIONS: Array<{
  value: RendicionLineaProgramatica
  label: string
}> = [
  { value: 'secos', label: 'Abordaje Comunitario - Línea Secos' },
  { value: 'tradicional', label: 'Abordaje Comunitario - Línea Tradicional' },
]

export function getRendicionLineaLabel(value: string | null | undefined): string {
  return (
    RENDICION_LINEA_OPTIONS.find((option) => option.value === value)?.label
    || RENDICION_LINEA_OPTIONS[1].label
  )
}

export function inferRendicionLineaProgramatica(
  programId?: number | null,
  programName?: string | null,
): RendicionLineaProgramatica {
  if (programId === 3) {
    return 'secos'
  }
  if (programId === 4) {
    return 'tradicional'
  }
  if (String(programName || '').toLowerCase().includes('secos')) {
    return 'secos'
  }
  return 'tradicional'
}
