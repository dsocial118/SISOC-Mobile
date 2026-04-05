# Docker

Este repo expone dos recorridos de contenedorizacion:

- desarrollo local con Vite y HMR;
- produccion con `nginx` sirviendo el build estatico.

## Archivos

- `compose.yaml`: base comun de build e imagen
- `compose.dev.yaml`: override de desarrollo
- `compose.prod.yaml`: override de produccion
- `Dockerfile`: targets `dev`, `build` y `prod`
- `nginx/default.conf`: configuracion SPA

## Criterios de diseno

- Desarrollo prioriza feedback rapido y aislar dependencias del host.
- Produccion prioriza una imagen pequena, reproducible y sin toolchain de Node en runtime.
- Produccion usa `nginx` no privilegiado y escucha en `8080` dentro del contenedor.
- La ruta `/api` se mantiene relativa para no acoplar el frontend a un host fijo.
- La politica de cache diferencia `index.html`, `manifest.webmanifest` y `sw.js` para no romper actualizaciones de la PWA.

## Limitaciones explicitas

- El backend no forma parte de este `docker compose`.
- TLS, dominio y reverse proxy quedan fuera del repo.
- Las variables `VITE_*` de produccion se resuelven en build, no en runtime.
