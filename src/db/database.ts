import Dexie, { type Table } from 'dexie'

export type UserRole = 'user' | 'org'

export interface SessionUserProfile {
  username: string
  email: string
  fullName: string
  mustChangePassword: boolean
  permissions: string[]
}

export interface UserSessionRecord {
  id: 'current'
  access_token: string
  role: UserRole
  user_key: string
  user_profile?: SessionUserProfile | null
  updated_at: string
}

export type OutboxStatus = 'pending' | 'processing' | 'failed'
export type OutboxType =
  | 'CREATE_NOTE'
  | 'CREATE_COLLABORATOR'
  | 'UPDATE_COLLABORATOR'
  | 'DELETE_COLLABORATOR'
  | 'CREATE_RENDICION'
  | 'UPLOAD_RENDICION_FILE'
  | 'DELETE_RENDICION_FILE'
  | 'PRESENT_RENDICION'
  | 'DELETE_RENDICION'

export interface OutboxRecord {
  id?: number
  type: OutboxType
  user_key?: string | null
  payload: Record<string, unknown>
  client_uuid: string
  status: OutboxStatus
  created_at: string
  attempts: number
  next_retry_at?: string | null
  last_error?: string | null
}

export interface NoteRecord {
  id: string
  name: string
  note: string
  photo_data_url?: string
  lat?: number
  lng?: number
  synced: boolean
  created_at: string
}

export type LocalSyncStatus = 'pending' | 'synced' | 'failed'

export type LocalRendicionPendingAction =
  | 'create'
  | 'present'
  | 'delete'
  | null

export type LocalRendicionFilePendingAction = 'upload' | 'delete' | null

export interface SpaceCollaboratorRecord {
  id: string
  user_key?: string | null
  space_id: number
  remote_id?: number | null
  ciudadano_id?: number | null
  nombre: string
  apellido: string
  dni: string
  prefijo_cuil?: string | null
  cuil_cuit?: string | null
  sufijo_cuil?: string | null
  sexo?: string | null
  genero: string
  fecha_nacimiento?: string | null
  edad?: number | null
  codigo_telefono: string
  numero_telefono: string
  fecha_alta: string
  fecha_baja?: string | null
  actividades: Array<{
    id: number
    alias: string
    nombre: string
  }>
  activo: boolean
  sync_status: LocalSyncStatus
  pending_action?: 'create' | 'update' | 'delete' | null
  last_error?: string | null
  created_at: string
  updated_at: string
}

export interface LocalRendicionRecord {
  id: string
  user_key?: string | null
  space_id: number
  remote_id?: number | null
  convenio: string | null
  numero_rendicion: number | null
  mes: number
  anio: number
  periodo_inicio: string | null
  periodo_fin: string | null
  periodo_label: string
  estado: string
  estado_label: string
  documento_adjunto: boolean
  observaciones: string | null
  sync_status: LocalSyncStatus
  pending_action?: LocalRendicionPendingAction
  last_error?: string | null
  created_at: string
  updated_at: string
}

export interface LocalRendicionFileRecord {
  id: string
  user_key?: string | null
  rendicion_id: string
  remote_id?: number | null
  categoria: string
  categoria_label: string
  documento_subsanado?: number | string | null
  nombre: string
  file_blob?: Blob | null
  mime_type?: string | null
  url?: string | null
  estado: string
  estado_label: string
  estado_visual_override?: string | null
  estado_label_visual_override?: string | null
  observaciones: string | null
  sync_status: LocalSyncStatus
  pending_action?: LocalRendicionFilePendingAction
  last_error?: string | null
  created_at: string
  updated_at: string
}

class AppDatabase extends Dexie {
  users_session!: Table<UserSessionRecord, string>
  outbox!: Table<OutboxRecord, number>
  notes!: Table<NoteRecord, string>
  space_collaborators!: Table<SpaceCollaboratorRecord, string>
  rendiciones!: Table<LocalRendicionRecord, string>
  rendicion_files!: Table<LocalRendicionFileRecord, string>

  constructor() {
    super('sisoc_offline_db')
    this.version(1).stores({
      users_session: 'id, role, updated_at',
      outbox: '++id, status, created_at, client_uuid, next_retry_at',
      notes: 'id, synced, created_at',
    })
    this.version(2).stores({
      users_session: 'id, role, updated_at',
      outbox: '++id, type, status, created_at, client_uuid, next_retry_at',
      notes: 'id, synced, created_at',
      space_collaborators: 'id, space_id, remote_id, activo, sync_status, updated_at',
    })
    this.version(3).stores({
      users_session: 'id, role, updated_at',
      outbox: '++id, type, status, created_at, client_uuid, next_retry_at',
      notes: 'id, synced, created_at',
      space_collaborators: 'id, space_id, remote_id, ciudadano_id, activo, sync_status, updated_at',
    })
    this.version(4).stores({
      users_session: 'id, role, updated_at',
      outbox: '++id, type, status, created_at, client_uuid, next_retry_at',
      notes: 'id, synced, created_at',
      space_collaborators: 'id, space_id, remote_id, ciudadano_id, activo, sync_status, updated_at',
      rendiciones:
        'id, space_id, remote_id, estado, sync_status, pending_action, updated_at',
      rendicion_files:
        'id, rendicion_id, remote_id, categoria, sync_status, pending_action, updated_at',
    })
    this.version(5).stores({
      users_session: 'id, role, user_key, updated_at',
      outbox: '++id, type, user_key, status, created_at, client_uuid, next_retry_at',
      notes: 'id, synced, created_at',
      space_collaborators:
        'id, user_key, space_id, remote_id, ciudadano_id, activo, sync_status, updated_at',
      rendiciones:
        'id, user_key, space_id, remote_id, estado, sync_status, pending_action, updated_at',
      rendicion_files:
        'id, user_key, rendicion_id, remote_id, categoria, sync_status, pending_action, updated_at',
    })
  }
}

export const db = new AppDatabase()
