import { http } from './http'
import axios from 'axios'

export type CapacitacionEstado = 'sin_presentar' | 'presentado' | 'rechazado' | 'aceptado'

export interface CapacitacionCertificadoItem {
  id: number
  capacitacion: string
  capacitacion_label: string
  estado: CapacitacionEstado
  estado_label: string
  archivo_url: string | null
  archivo_nombre: string | null
  observacion: string | null
  fecha_presentacion: string | null
  fecha_revision: string | null
  presentado_por: string | null
  revisado_por: string | null
  origen?: 'capacitacion' | 'intervencion'
  intervencion_id?: number | null
  fecha_origen?: string | null
}

export interface CapacitacionesResponse {
  formando_capital_humano: {
    label: string
    url: string
  } | null
  results: CapacitacionCertificadoItem[]
}

export async function listSpaceCapacitaciones(
  spaceId: string | number,
): Promise<CapacitacionesResponse> {
  try {
    const { data } = await http.get<CapacitacionCertificadoItem[] | CapacitacionesResponse>(
      `/comedores/${spaceId}/capacitaciones/`,
      { timeout: 60000 },
    )
    if (Array.isArray(data)) {
      return {
        formando_capital_humano: null,
        results: data,
      }
    }
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        formando_capital_humano: null,
        results: [],
      }
    }
    throw error
  }
}

export async function uploadSpaceCapacitacionCertificado(
  spaceId: string | number,
  capacitacion: string,
  archivo: File,
): Promise<CapacitacionCertificadoItem> {
  const formData = new FormData()
  formData.append('capacitacion', capacitacion)
  formData.append('archivo', archivo)

  const { data } = await http.post<CapacitacionCertificadoItem>(
    `/comedores/${spaceId}/capacitaciones/subir/`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    },
  )
  return data
}

export async function deleteSpaceCapacitacionCertificado(
  spaceId: string | number,
  capacitacion: string,
): Promise<CapacitacionCertificadoItem> {
  const { data } = await http.post<CapacitacionCertificadoItem>(
    `/comedores/${spaceId}/capacitaciones/eliminar/`,
    { capacitacion },
  )
  return data
}
