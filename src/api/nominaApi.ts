import { http } from './http'
import { fixMojibake } from './mojibake'

export type NominaTab = 'consolidada' | 'alimentaria' | 'formacion'

export interface NominaStats {
  total_nomina: number
  genero: {
    M: number
    F: number
    X: number
  }
  menores_edad: number
  mayores_edad: number
}

export interface NominaActividad {
  actividad_id: number
  categoria: string
  actividad: string
  dia: string
  horario: string
}

export interface NominaAttendanceRecord {
  id: number
  periodicidad: string
  periodo_referencia: string
  periodo_label: string
  fecha_toma_asistencia: string
  tomado_por: string | null
}

export interface NominaObservationRecord {
  id: number
  texto: string
  fecha_creacion: string
  creada_por: string | null
}

export interface NominaPerson {
  id: number
  nombre: string
  apellido: string
  dni: string
  genero: string
  fecha_nacimiento: string | null
  estado: string
  badges: string[]
  actividades: NominaActividad[]
  cantidad_actividades: number
  es_indocumentado: boolean
  pertenece_comunidad_indigena: boolean
  situacion_calle: boolean
  persona_con_celiaquia: boolean
  identificador_interno: string | null
  asistencia_mes_actual: NominaAttendanceRecord | null
  historial_asistencias: NominaAttendanceRecord[]
  observaciones: string | null
  observaciones_historial?: NominaObservationRecord[]
}

export interface NominaResponse {
  tab: NominaTab
  stats: NominaStats
  results: NominaPerson[]
  _source?: 'network' | 'cache'
}

export interface NominaGender {
  id: number
  sexo: string
}

export interface NominaRenaperPreview {
  nombre: string
  apellido: string
  documento: string
  fecha_nacimiento: string | null
  sexo: string
}

export interface CreateNominaPayload {
  ciudadano_id?: number
  nombre?: string
  apellido?: string
  dni?: string
  sexo_id?: number
  fecha_nacimiento?: string
  es_indocumentado?: boolean
  pertenece_comunidad_indigena?: boolean
  situacion_calle?: boolean
  persona_con_celiaquia?: boolean
  identificador_interno?: string
  asistencia_alimentaria: boolean
  asistencia_actividades: boolean
  actividad_ids: number[]
  observaciones?: string
}

export interface BulkNominaAttendanceResponse {
  periodo_referencia: string
  periodo_label: string
  selected_nomina_ids: number[]
  created_count: number
  deleted_count: number
  nomina_destinatarios_documento?: {
    id: number
    periodo_referencia: string
    periodo_label: string
    version: number
    cantidad_destinatarios: number
    fecha_generacion: string
    archivo_url: string
    archivo_nombre: string
  } | null
}

export interface NominaAttendancePeriodItem {
  periodo_referencia: string
  periodo_label: string
  total_asistentes: number
  nomina_destinatarios_documento: {
    id: number
    periodo_referencia: string
    periodo_label: string
    version: number
    cantidad_destinatarios: number
    fecha_generacion: string
    archivo_url: string
    archivo_nombre: string
  } | null
}

export interface NominaAttendancePeriodResponse {
  tab: NominaTab
  results: NominaAttendancePeriodItem[]
}

export interface NominaAttendanceAttendee {
  id: number
  nomina_id: number
  nombre: string
  apellido: string
  dni: string
  genero: string
  fecha_toma_asistencia: string
  tomado_por: string | null
}

export interface NominaAttendancePeriodDetail {
  tab: NominaTab
  periodo_referencia: string
  periodo_label: string
  total_asistentes: number
  nomina_destinatarios_documento: NominaAttendancePeriodItem['nomina_destinatarios_documento']
  asistentes: NominaAttendanceAttendee[]
}

// Per-field mojibake recovery for nomina records. Generic UTF-8/Latin-1
// repair is handled centrally by the http response interceptor (see
// mojibake.ts); this layer only adds known fixes for cases that already lost
// a byte to the replacement character (U+FFFD) and cannot be recovered
// generically.
function normalizeMojibake(value: string | null | undefined): string {
  const input = value ?? ''
  if (!input.trim()) {
    return input
  }
  const knownFixes: Array<[RegExp, string]> = [
    [/\bAgla�\b/giu, 'Aglaé'],
  ]
  let result = input
  for (const [pattern, replacement] of knownFixes) {
    result = result.replace(pattern, replacement)
  }
  return fixMojibake(result)
}

function normalizeNominaPerson(person: NominaPerson): NominaPerson {
  return {
    ...person,
    nombre: normalizeMojibake(person.nombre),
    apellido: normalizeMojibake(person.apellido),
    genero: normalizeMojibake(person.genero),
    observaciones: person.observaciones ? normalizeMojibake(person.observaciones) : person.observaciones,
    actividades: person.actividades.map((activity) => ({
      ...activity,
      categoria: normalizeMojibake(activity.categoria),
      actividad: normalizeMojibake(activity.actividad),
      dia: normalizeMojibake(activity.dia),
      horario: normalizeMojibake(activity.horario),
    })),
    asistencia_mes_actual: person.asistencia_mes_actual
      ? {
          ...person.asistencia_mes_actual,
          tomado_por: person.asistencia_mes_actual.tomado_por
            ? normalizeMojibake(person.asistencia_mes_actual.tomado_por)
            : person.asistencia_mes_actual.tomado_por,
        }
      : null,
    historial_asistencias: person.historial_asistencias.map((record) => ({
      ...record,
      tomado_por: record.tomado_por ? normalizeMojibake(record.tomado_por) : record.tomado_por,
      periodo_label: normalizeMojibake(record.periodo_label),
      periodicidad: normalizeMojibake(record.periodicidad),
    })),
    observaciones_historial: person.observaciones_historial?.map((record) => ({
      ...record,
      texto: normalizeMojibake(record.texto),
      creada_por: record.creada_por ? normalizeMojibake(record.creada_por) : record.creada_por,
    })),
  }
}

function buildNominaCacheKey(
  spaceId: string | number,
  options?: { tab?: NominaTab; q?: string },
): string {
  const tab = options?.tab || 'consolidada'
  const query = (options?.q || '').trim().toLowerCase()
  return `sisoc:nomina:list:${spaceId}:${tab}:${query}`
}

function readNominaCache(cacheKey: string): NominaResponse | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as NominaResponse
    return {
      ...parsed,
      results: parsed.results.map(normalizeNominaPerson),
    }
  } catch {
    return null
  }
}

function writeNominaCache(cacheKey: string, value: NominaResponse): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(value))
  } catch {
    // no-op
  }
}

export async function listSpaceNomina(
  spaceId: string | number,
  options?: { tab?: NominaTab; q?: string },
): Promise<NominaResponse> {
  const cacheKey = buildNominaCacheKey(spaceId, options)
  async function fetchWithTimeout(timeout: number): Promise<NominaResponse> {
    const { data } = await http.get<NominaResponse>(`/pwa/espacios/${spaceId}/nomina/`, {
      params: options,
      timeout,
    })
    const response = {
      ...data,
      results: data.results.map(normalizeNominaPerson),
      _source: 'network' as const,
    }
    writeNominaCache(cacheKey, response)
    return response
  }

  function isTimeoutError(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code
    const message = String((error as { message?: string } | null)?.message || '')
    return code === 'ECONNABORTED' || message.toLowerCase().includes('timeout')
  }

  try {
    return await fetchWithTimeout(12000)
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error
    }
  }

  try {
    return await fetchWithTimeout(30000)
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error
    }
  }

  try {
    return await fetchWithTimeout(60000)
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error
    }
    const cached = readNominaCache(cacheKey)
    if (cached) {
      return { ...cached, _source: 'cache' }
    }
    throw error
  }
}

export async function listNominaGenders(spaceId: string | number): Promise<NominaGender[]> {
  const { data } = await http.get<NominaGender[]>(`/pwa/espacios/${spaceId}/nomina/generos/`)
  return data
}

export async function previewNominaDni(
  spaceId: string | number,
  dni: string,
): Promise<NominaRenaperPreview> {
  const { data } = await http.post<NominaRenaperPreview>(
    `/pwa/espacios/${spaceId}/nomina/preview-dni/`,
    { dni },
    { timeout: 60000 },
  )
  return {
    ...data,
    nombre: normalizeMojibake(data.nombre),
    apellido: normalizeMojibake(data.apellido),
    sexo: normalizeMojibake(data.sexo),
  }
}

export async function createNominaPerson(
  spaceId: string | number,
  payload: CreateNominaPayload,
): Promise<NominaPerson> {
  const { data } = await http.post<NominaPerson>(`/pwa/espacios/${spaceId}/nomina/`, payload, {
    timeout: 60000,
  })
  return normalizeNominaPerson(data)
}

export async function updateNominaPerson(
  spaceId: string | number,
  nominaId: string | number,
  payload: Partial<CreateNominaPayload>,
): Promise<NominaPerson> {
  const { data } = await http.patch<NominaPerson>(`/pwa/espacios/${spaceId}/nomina/${nominaId}/`, payload, {
    timeout: 60000,
  })
  return normalizeNominaPerson(data)
}

export async function getNominaPersonDetail(
  spaceId: string | number,
  nominaId: string | number,
): Promise<NominaPerson> {
  const { data } = await http.get<NominaPerson>(`/pwa/espacios/${spaceId}/nomina/${nominaId}/`, {
    timeout: 60000,
  })
  return normalizeNominaPerson(data)
}

export async function deleteNominaPerson(spaceId: string | number, nominaId: string | number): Promise<void> {
  await http.delete(`/pwa/espacios/${spaceId}/nomina/${nominaId}/`)
}

export async function registerNominaAttendance(
  spaceId: string | number,
  nominaId: string | number,
): Promise<{ created: boolean; registro: NominaAttendanceRecord }> {
  const { data } = await http.post<{ created: boolean; registro: NominaAttendanceRecord }>(
    `/pwa/espacios/${spaceId}/nomina/${nominaId}/registrar-asistencia/`,
  )
  return data
}

export async function listNominaAttendanceHistory(
  spaceId: string | number,
  nominaId: string | number,
): Promise<NominaAttendanceRecord[]> {
  const { data } = await http.get<NominaAttendanceRecord[]>(
    `/pwa/espacios/${spaceId}/nomina/${nominaId}/historial-asistencia/`,
    { timeout: 60000 },
  )
  return data
}

export async function syncNominaAlimentariaAttendance(
  spaceId: string | number,
  nominaIds: number[],
  periodo: string,
): Promise<BulkNominaAttendanceResponse> {
  const { data } = await http.post<BulkNominaAttendanceResponse>(
    `/pwa/espacios/${spaceId}/nomina/asistencia-alimentaria/`,
    { nomina_ids: nominaIds, periodo },
  )
  return data
}

export async function listNominaAttendancePeriods(
  spaceId: string | number,
  options?: { tab?: NominaTab },
): Promise<NominaAttendancePeriodResponse> {
  const { data } = await http.get<NominaAttendancePeriodResponse>(
    `/pwa/espacios/${spaceId}/nomina/asistencias-periodos/`,
    { params: options },
  )
  return data
}

export async function getNominaAttendancePeriodDetail(
  spaceId: string | number,
  periodo: string,
  options?: { tab?: NominaTab },
): Promise<NominaAttendancePeriodDetail> {
  const { data } = await http.get<NominaAttendancePeriodDetail>(
    `/pwa/espacios/${spaceId}/nomina/asistencias-periodo/`,
    {
      params: {
        ...options,
        periodo,
      },
    },
  )
  return data
}
