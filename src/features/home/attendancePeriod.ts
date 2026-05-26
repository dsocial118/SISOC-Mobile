export interface NominaAttendancePeriod {
  periodLabel: string
  windowLabel: string
  isEnabled: boolean
  isOpeningDay: boolean
  enabledMessage: string
  disabledMessage: string
}

function formatPeriodLabel(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

export function getNominaAttendancePeriod(referenceDate = new Date()): NominaAttendancePeriod {
  const day = referenceDate.getDate()
  const periodDate =
    day <= 10
      ? new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1)
      : new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const startsAt = new Date(periodDate.getFullYear(), periodDate.getMonth(), 25)
  const endsAt = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 10)
  const periodLabel = formatPeriodLabel(periodDate)
  const windowLabel = `${formatShortDate(startsAt)} al ${formatShortDate(endsAt)}`
  const isEnabled = day >= 25 || day <= 10

  return {
    periodLabel,
    windowLabel,
    isEnabled,
    isOpeningDay: day === 25,
    enabledMessage: `Ya esta habilitada la asistencia del periodo ${periodLabel}. Se puede tomar del ${windowLabel}.`,
    disabledMessage: `La asistencia del periodo ${periodLabel} se habilita del ${windowLabel}.`,
  }
}
