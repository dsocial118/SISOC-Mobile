# SiSOC Mobil

Proyecto base para campo con:

- Vite + React + TypeScript
- React Router
- TailwindCSS
- TanStack Query
- Dexie (IndexedDB)
- Workbox (via `vite-plugin-pwa`)
- React Hook Form + Zod
- uuid + browser-image-compression

## Estructura

`src/auth/`, `src/api/`, `src/db/`, `src/sync/`, `src/device/`, `src/pwa/`, `src/features/`, `src/ui/`

## Variables de entorno

Crea un `.env` opcional:

```bash
VITE_API_BASE_URL=/api
VITE_DEV_API_TARGET=http://localhost:8001
```

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Flujo offline-first implementado

1. El formulario demo guarda en `notes` (Dexie).
2. Se agrega accion `CREATE_NOTE` en tabla `outbox` con `client_uuid`.
3. Al reconectar (evento `online` o boton manual), se ejecuta `syncNow()`.
4. El sync procesa outbox en orden por `created_at`, usa headers de idempotencia y aplica reintentos con backoff.
5. Si sincroniza OK, elimina item de outbox y marca nota local como `synced`.

## Rutas

- `/login`
- `/app-user/*` protegido por rol `user`
- `/app-org/*` protegido por rol `org`

## Backend esperado (Django REST + DRF Token)

- `POST /api/users/login/`
- `GET /api/users/me/`
- `POST /api/users/logout/`
- `POST /api/notes/`
