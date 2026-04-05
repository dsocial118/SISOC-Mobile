# Mi Espacio

Frontend PWA construido con Vite, React y TypeScript. El proyecto puede levantarse sin Docker o con una configuracion de `docker compose` separada para desarrollo local y produccion.

## Stack

- Vite + React + TypeScript
- React Router
- TailwindCSS
- TanStack Query
- Dexie (IndexedDB)
- Workbox via `vite-plugin-pwa`
- React Hook Form + Zod
- Axios + utilidades offline-first

## Prerrequisitos

- Node.js 22 LTS + npm 10 si trabajas sin Docker
- Docker Engine + Docker Compose Plugin si trabajas con contenedores
- Un backend accesible en desarrollo para resolver `/api`

## Variables de entorno

Este repo ya usa variables `VITE_*` convencionales de Vite.

Archivo esperado para desarrollo local:

```env
VITE_API_BASE_URL=/api
VITE_DEV_API_TARGET=http://localhost:8002
VITE_PUBLIC_BASE_PATH=/
```

Puedes partir de:

```bash
cp .env.example .env
```

Notas:

- `VITE_API_BASE_URL=/api` mantiene las llamadas del frontend en una ruta relativa.
- En desarrollo, Vite hace proxy de `/api` hacia `VITE_DEV_API_TARGET`.
- `VITE_PUBLIC_BASE_PATH` define bajo qué prefijo se publica la SPA. En local debe quedarse en `/`.
- En produccion, el frontend se construye con `VITE_API_BASE_URL=/api` y se asume que la infraestructura externa enruta esa ruta al backend.

## Desarrollo sin Docker

Instalacion y arranque:

```bash
npm install
npm run dev
```

La aplicacion queda disponible normalmente en `http://localhost:5173`.

Build local:

```bash
npm run build
npm run preview
```

## Desarrollo con Docker Compose

Este flujo usa un contenedor Node con bind mount del proyecto, volumen dedicado para `node_modules` y Vite con HMR.

Levantar el entorno:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Detenerlo:

```bash
docker compose -f compose.yaml -f compose.dev.yaml down
```

Detalles operativos:

- El frontend queda expuesto en `http://localhost:5173`.
- Los cambios en `src/` se reflejan por HMR.
- El contenedor no depende de `node_modules` del host.
- Si tu backend local corre en otra URL o puerto, cambia `VITE_DEV_API_TARGET` en `.env`.

## Produccion con Docker Compose

Produccion usa una imagen multi-stage:

- etapa `build`: compila el frontend con Vite;
- etapa `prod`: sirve `dist/` con `nginx`.

Build de la imagen:

```bash
docker compose -f compose.yaml -f compose.prod.yaml build
```

Arranque:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

Detencion:

```bash
docker compose -f compose.yaml -f compose.prod.yaml down
```

Por defecto el contenedor publica `127.0.0.1:8080 -> 8080`, asi que puedes validar el frontend en:

```text
http://127.0.0.1:8080
```

Variables utiles para produccion:

```bash
FRONTEND_PORT=8080
FRONTEND_BIND_ADDRESS=127.0.0.1
IMAGE_TAG=latest
NODE_VERSION=22.14.0
VITE_API_BASE_URL=/api
VITE_PUBLIC_BASE_PATH=/mobile/
```

Supuestos de infraestructura:

- este repo solo empaqueta el frontend;
- el backend no forma parte de `docker compose`;
- un proxy externo debe manejar dominio, TLS y routing real de `/api` en produccion.
- el contenedor de produccion corre con imagen `nginx` no privilegiada, filesystem read-only y `tmpfs` solo para temporales.

## Nginx del servidor

Si en produccion ya tienes un `nginx` a nivel servidor, la forma correcta de integrarlo es:

- el `nginx` del servidor termina TLS y enruta por dominio;
- el `nginx` del contenedor sirve la SPA y aplica cache/headers de PWA;
- el `nginx` del servidor deriva `/mobile/` al frontend en `127.0.0.1:8080`;
- el resto del sitio puede seguir yendo al backend actual;
- `/api/` puede seguir yendo al backend real.

Ejemplo base:

- [docs/nginx-server.example.conf](/home/juanikitro/SISOC-Mobile/docs/nginx-server.example.conf)

Que debes adaptar:

- `TU_DOMINIO`;
- rutas de certificados TLS;
- upstream del backend, por ejemplo `127.0.0.1:8002`, `127.0.0.1:8000` o un nombre DNS interno;
- `client_max_body_size` si la app sube archivos mas grandes.
- el prefijo `/mobile/`, que debe coincidir con `VITE_PUBLIC_BASE_PATH=/mobile/`.

## Archivos Docker

- `Dockerfile`: imagen multi-stage para desarrollo y produccion
- `compose.yaml`: definicion base comun
- `compose.dev.yaml`: override de desarrollo con Vite y HMR
- `compose.prod.yaml`: override de produccion con `nginx`
- `nginx/default.conf`: configuracion SPA para servir `dist/`
- `nginx/security-headers.conf`: headers comunes de seguridad para todas las respuestas relevantes
- `.dockerignore`: reduce el contexto de build

Notas tecnicas complementarias:

- [docs/docker.md](/home/juanikitro/SISOC-Mobile/docs/docker.md)

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Validacion recomendada

Desarrollo:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

Comprueba:

- que la UI carga en `http://localhost:5173`;
- que un cambio en `src/` refresca la aplicacion;
- que una llamada a `/api/...` llega al backend configurado en `VITE_DEV_API_TARGET`.

Produccion:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up --build -d
```

Comprueba:

- que la UI carga en `http://127.0.0.1:8080`;
- que una ruta profunda de React Router responde correctamente al recargar;
- que los assets bajo `/assets/` se sirven sin errores.
- que `manifest.webmanifest` y `sw.js` responden correctamente y no quedan cacheados de forma agresiva.
- que la instalacion PWA y las actualizaciones siguen funcionando en movil.
- si la publicas bajo un prefijo, que el build haya sido generado con el mismo `VITE_PUBLIC_BASE_PATH`.

## Endurecimiento de produccion

La imagen y el contenedor de produccion quedaron endurecidos para un despliegue real:

- `nginx` no privilegiado, escuchando en `8080` dentro del contenedor;
- `cap_drop: [ALL]`;
- `no-new-privileges`;
- filesystem `read_only` con `tmpfs` para temporales de `nginx`;
- headers de seguridad HTTP;
- `Content-Security-Policy` compatible con la PWA actual;
- cache diferenciada para `assets`, `index.html`, `manifest.webmanifest`, `sw.js` y `registerSW.js`.

Esto es importante para una SPA instalable en moviles: si cacheas mal el `service worker` o el `manifest`, los usuarios se quedan con instalaciones viejas o con actualizaciones impredecibles.

## Checklist de release a produccion

Antes de publicar:

```bash
npm install
npm run lint
npm run build
docker compose -f compose.yaml -f compose.prod.yaml build
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

Validaciones minimas:

- abrir la app en navegador de escritorio y en modo responsive;
- abrir una ruta interna directamente y confirmar que no devuelve 404;
- verificar que `/sw.js` responde `200`;
- verificar que `/manifest.webmanifest` responde `200`;
- instalar la PWA en un dispositivo movil o simulador;
- confirmar que login y llamadas `/api` funcionan en el dominio final.

Secuencia exacta de verificacion post-deploy en produccion:

```bash
docker compose -f compose.yaml -f compose.prod.yaml ps
curl -I https://TU_DOMINIO/
curl -I https://TU_DOMINIO/mobile/
curl -I https://TU_DOMINIO/mobile/sw.js
curl -I https://TU_DOMINIO/mobile/manifest.webmanifest
curl -I https://TU_DOMINIO/mobile/assets/index-ALGUN_HASH.js
curl -I https://TU_DOMINIO/mobile/app-user/
curl -I https://TU_DOMINIO/api/ALGun_ENDPOINT_DE_SALUD
```

Que debes validar en esas respuestas:

- `/mobile/` debe responder `200` y `Cache-Control: no-cache, no-store, must-revalidate`;
- `/mobile/sw.js` debe responder `200` y `Cache-Control: no-cache, no-store, must-revalidate`;
- `/mobile/manifest.webmanifest` debe responder `200` y `Cache-Control: public, max-age=0, must-revalidate`;
- `/mobile/assets/...` debe responder `200` y `Cache-Control: public, max-age=31536000, immutable`;
- todas las rutas HTML relevantes deben incluir `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`;
- una ruta SPA como `/mobile/app-user/` debe responder `200`, no `404`.
- `/api/...` debe responder segun tu backend, pero no debe devolver `502` ni `404` del proxy del servidor.

Verificacion funcional manual recomendada:

```bash
docker compose -f compose.yaml -f compose.prod.yaml logs --tail=100 frontend
```

- abrir la URL final desde movil;
- instalar la PWA;
- cerrar y reabrir la PWA instalada;
- verificar login;
- navegar a una ruta interna y recargar;
- confirmar que el mapa embebido carga;
- confirmar que geolocalizacion y camara solo se solicitan cuando corresponde.

## Estructura

`src/auth/`, `src/api/`, `src/db/`, `src/sync/`, `src/device/`, `src/pwa/`, `src/features/`, `src/ui/`

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
