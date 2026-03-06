import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { v4 as uuidv4 } from 'uuid'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import { getGPS } from '../../device/geolocation'
import { pickFromGallery, takePhoto } from '../../device/media'
import { syncNow } from '../../sync/engine'

const noteSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres'),
  note: z.string().min(2, 'Minimo 2 caracteres'),
})

type NoteFormValues = z.infer<typeof noteSchema>

export function NoteDemoPage() {
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>()
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>()
  const [status, setStatus] = useState<string | null>(null)

  const notes = useLiveQuery(
    async () => db.notes.orderBy('created_at').reverse().limit(8).toArray(),
    [],
  )

  const { register, handleSubmit, formState, reset } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
  })

  async function onSubmit(values: NoteFormValues) {
    const id = uuidv4()
    const client_uuid = uuidv4()
    const createdAt = new Date().toISOString()

    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.put({
        id,
        name: values.name,
        note: values.note,
        photo_data_url: photoDataUrl,
        lat: coords?.lat,
        lng: coords?.lng,
        synced: false,
        created_at: createdAt,
      })

      await db.outbox.add({
        type: 'CREATE_NOTE',
        client_uuid,
        payload: {
          id,
          name: values.name,
          note: values.note,
          photo_data_url: photoDataUrl,
          lat: coords?.lat,
          lng: coords?.lng,
        },
        status: 'pending',
        created_at: createdAt,
        attempts: 0,
        next_retry_at: null,
        last_error: null,
      })
    })

    setStatus('Guardado localmente y encolado en outbox.')
    reset()
    setPhotoDataUrl(undefined)
    setCoords(undefined)
  }

  async function handleCamera() {
    const photo = await takePhoto()
    if (!photo) {
      return
    }
    setPhotoDataUrl(photo.data_url)
  }

  async function handleGallery() {
    const photo = await pickFromGallery()
    if (!photo) {
      return
    }
    setPhotoDataUrl(photo.data_url)
  }

  async function handleGPS() {
    try {
      const point = await getGPS()
      setCoords({ lat: point.lat, lng: point.lng })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo obtener GPS')
    }
  }

  return (
    <section className="space-y-6">
      <div className="progressive-card rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Formulario Offline</h2>
        <p className="text-sm text-slate-500">
          Crea una nota offline, adjunta foto/GPS y encola accion CREATE_NOTE.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre</label>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              {...register('name')}
            />
            <p className="mt-1 text-xs text-red-600">{formState.errors.name?.message}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Nota</label>
            <textarea
              rows={3}
              className="w-full rounded border border-slate-300 px-3 py-2"
              {...register('note')}
            />
            <p className="mt-1 text-xs text-red-600">{formState.errors.note?.message}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCamera()}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => void handleGallery()}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              Galeria
            </button>
            <button
              type="button"
              onClick={() => void handleGPS()}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              Capturar GPS
            </button>
            <button
              type="button"
              onClick={() => void syncNow()}
              className="rounded border border-teal-700 px-3 py-2 text-sm text-teal-800"
            >
              Sincronizar ahora
            </button>
          </div>

          {photoDataUrl ? (
            <img
              src={photoDataUrl}
              alt="Preview"
              className="h-36 w-36 rounded border border-slate-200 object-cover"
            />
          ) : null}

          {coords ? (
            <p className="text-sm text-slate-700">
              GPS: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="rounded bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {formState.isSubmitting ? 'Guardando...' : 'Guardar offline'}
          </button>
        </form>

        {status ? <p className="mt-3 text-sm text-emerald-700">{status}</p> : null}
      </div>

      <div className="progressive-card rounded-xl bg-white p-5 shadow-sm" style={{ ['--card-delay' as string]: '80ms' }}>
        <h3 className="text-base font-semibold text-slate-900">Notas locales (cache entities)</h3>
        <ul className="mt-3 space-y-2">
          {(notes ?? []).map((item, index) => (
            <li
              key={item.id}
              className="progressive-card rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              style={{ ['--card-delay' as string]: `${120 + index * 50}ms` }}
            >
              <p className="font-medium">{item.name}</p>
              <p className="text-slate-600">{item.note}</p>
              <p className="text-xs text-slate-500">
                Estado: {item.synced ? 'sincronizada' : 'pendiente'}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
