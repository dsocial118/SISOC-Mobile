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

## Deploy operativo en VM

El repo incluye un script standalone para refrescar produccion desde una VM Linux simple:

```bash
bash scripts/operacion/deploy_refresh.sh --expected-branch main
```

El script detecta la raiz del repo desde su propia ubicacion, valida que el checkout sea Git y usa siempre:

```bash
docker compose -f compose.yaml -f compose.prod.yaml --project-directory "$ROOT_DIR" ...
```

Flujo principal:

1. `git fetch origin --prune`
2. `docker compose ... config -q`
3. `docker compose ... down --remove-orphans`
4. `git pull --ff-only origin <branch_actual>`
5. `docker compose ... up -d --build`
6. `docker compose ... ps`

Opciones utiles:

- `--dry-run`: imprime los comandos del flujo sin ejecutarlos.
- `--yes`: omite confirmaciones.
- `--volumes`: agrega `--volumes` al `down`; pide confirmacion salvo con `--yes` o `--dry-run`.
- `--skip-pull`: no hace `fetch` ni `pull`; solo valida y reinicia Docker.
- `--allow-dirty`: permite continuar con cambios tracked locales.
- `--expected-branch BRANCH`: bloquea si la branch actual no coincide.
- `--allow-branch-mismatch`: omite ese bloqueo.

Por defecto no borra volumenes y no bloquea por branch si no se indica `--expected-branch`.
