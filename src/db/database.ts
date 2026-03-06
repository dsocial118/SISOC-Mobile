import Dexie, { type Table } from 'dexie'

export type UserRole = 'user' | 'org'

export interface SessionUserProfile {
  username: string
  email: string
  fullName: string
}

export interface UserSessionRecord {
  id: 'current'
  access_token: string
  role: UserRole
  user_profile?: SessionUserProfile | null
  updated_at: string
}

export type OutboxStatus = 'pending' | 'processing' | 'failed'
export type OutboxType =
  | 'CREATE_NOTE'
  | 'CREATE_COLLABORATOR'
  | 'UPDATE_COLLABORATOR'
  | 'DELETE_COLLABORATOR'

export interface OutboxRecord {
  id?: number
  type: OutboxType
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

export interface SpaceCollaboratorRecord {
  id: string
  space_id: number
  remote_id?: number | null
  nombre: string
  apellido: string
  dni: string
  telefono: string
  email: string
  rol_funcion: string
  activo: boolean
  sync_status: LocalSyncStatus
  pending_action?: 'create' | 'update' | 'delete' | null
  last_error?: string | null
  created_at: string
  updated_at: string
}

class AppDatabase extends Dexie {
  users_session!: Table<UserSessionRecord, string>
  outbox!: Table<OutboxRecord, number>
  notes!: Table<NoteRecord, string>
  space_collaborators!: Table<SpaceCollaboratorRecord, string>

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
  }
}

export const db = new AppDatabase()
