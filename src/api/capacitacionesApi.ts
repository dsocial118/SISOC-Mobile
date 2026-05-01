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
}

export async function listSpaceCapacitaciones(
  spaceId: string | number,
): Promise<CapacitacionCertificadoItem[]> {
  try {
    const { data } = await http.get<CapacitacionCertificadoItem[]>(
      `/comedores/${spaceId}/capacitaciones/`,
      { timeout: 60000 },
    )
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return []
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
