import { http } from './http'

export interface FormacionCursoItem {
  id: number
  nombre: string
  link: string
  descripcion: string | null
  programa_objetivo: 'pnud' | 'alimentar_comunidad' | 'ambos'
  es_recomendado: boolean
  activo: boolean
  orden: number
  imagen_url: string | null
}

export interface FormacionCursosResponse {
  results: FormacionCursoItem[]
}

export async function listFormacionCursos(
  spaceId: string | number,
): Promise<FormacionCursoItem[]> {
  const { data } = await http.get<FormacionCursosResponse>(
    `/pwa/espacios/${spaceId}/formacion/cursos/`,
    { timeout: 30000 },
  )
  return data.results || []
}
