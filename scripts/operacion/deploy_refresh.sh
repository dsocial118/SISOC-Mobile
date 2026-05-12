#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"

DRY_RUN=false
YES=false
REMOVE_VOLUMES=false
SKIP_PULL=false
ALLOW_DIRTY=false
EXPECTED_BRANCH=""
ALLOW_BRANCH_MISMATCH=false

usage() {
  cat <<'EOF'
Uso:
  scripts/operacion/deploy_refresh.sh [opciones]

Refresca el deploy productivo de SISOC-Mobile en una VM Linux simple.
Usa siempre:
  docker compose -f compose.yaml -f compose.prod.yaml --project-directory "$ROOT_DIR" ...

Flujo:
  1. git fetch origin --prune
  2. docker compose ... config -q
  3. docker compose ... down --remove-orphans
  4. git pull --ff-only origin <branch_actual>
  5. docker compose ... up -d --build
  6. docker compose ... ps

Opciones:
  --dry-run                 Imprime los comandos del flujo sin ejecutarlos.
  --yes                     No pide confirmaciones.
  --volumes                 Agrega --volumes al down. Pide confirmacion salvo con --yes o --dry-run.
  --skip-pull               No hace fetch ni pull; solo valida/reinicia Docker.
  --allow-dirty             Permite continuar con cambios tracked locales.
  --expected-branch BRANCH  Bloquea si la branch actual no coincide con BRANCH.
  --allow-branch-mismatch   Omite el bloqueo de --expected-branch.
  -h, --help                Muestra esta ayuda.

Ejemplos:
  bash scripts/operacion/deploy_refresh.sh --dry-run
  bash scripts/operacion/deploy_refresh.sh --expected-branch main
  bash scripts/operacion/deploy_refresh.sh --skip-pull --yes
  bash scripts/operacion/deploy_refresh.sh --volumes --yes

Notas:
  - No borra volumenes por defecto.
  - No usa sudo para operaciones Git.
  - En --dry-run se validan contexto y opciones, pero no se ejecutan comandos del flujo.
EOF
}

log() {
  printf '[deploy-refresh] %s\n' "$*"
}

die() {
  printf '[deploy-refresh] ERROR: %s\n' "$*" >&2
  exit 1
}

print_cmd() {
  printf '+'
  local arg
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
}

run() {
  print_cmd "$@"
  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi
  "$@"
}

has_tracked_changes() {
  ! git -C "$ROOT_DIR" diff --quiet --ignore-submodules -- ||
    ! git -C "$ROOT_DIR" diff --cached --quiet --ignore-submodules --
}

confirm_volumes_if_needed() {
  if [[ "$REMOVE_VOLUMES" != "true" || "$YES" == "true" || "$DRY_RUN" == "true" ]]; then
    return 0
  fi

  printf '[deploy-refresh] ATENCION: --volumes eliminara volumenes de Docker Compose.\n' >&2
  printf '[deploy-refresh] Esto puede borrar datos persistidos del proyecto.\n' >&2
  read -r -p "Para continuar escribi 'ELIMINAR VOLUMENES': " confirmation

  if [[ "$confirmation" != "ELIMINAR VOLUMENES" ]]; then
    die "Operacion cancelada: no se confirmo eliminacion de volumenes."
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --yes)
      YES=true
      shift
      ;;
    --volumes)
      REMOVE_VOLUMES=true
      shift
      ;;
    --skip-pull)
      SKIP_PULL=true
      shift
      ;;
    --allow-dirty)
      ALLOW_DIRTY=true
      shift
      ;;
    --expected-branch)
      [[ $# -ge 2 ]] || die "--expected-branch requiere un valor."
      EXPECTED_BRANCH="$2"
      [[ -n "$EXPECTED_BRANCH" ]] || die "--expected-branch no puede estar vacio."
      shift 2
      ;;
    --allow-branch-mismatch)
      ALLOW_BRANCH_MISMATCH=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      die "Opcion desconocida: $1. Usa --help."
      ;;
    *)
      die "Argumento inesperado: $1. Usa --help."
      ;;
  esac
done

[[ $# -eq 0 ]] || die "Argumentos inesperados: $*. Usa --help."

git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
  die "La raiz detectada no esta dentro de un repo Git: $ROOT_DIR"

[[ -f "$ROOT_DIR/compose.yaml" ]] || die "No existe $ROOT_DIR/compose.yaml"
[[ -f "$ROOT_DIR/compose.prod.yaml" ]] || die "No existe $ROOT_DIR/compose.prod.yaml"

CURRENT_BRANCH="$(git -C "$ROOT_DIR" symbolic-ref --quiet --short HEAD || true)"
if [[ -z "$CURRENT_BRANCH" && "$SKIP_PULL" != "true" ]]; then
  die "No se pudo detectar una branch actual. Usa una branch Git o --skip-pull para solo reiniciar Docker."
fi

if [[ -n "$EXPECTED_BRANCH" && "$ALLOW_BRANCH_MISMATCH" != "true" && "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  die "Branch actual '$CURRENT_BRANCH' no coincide con --expected-branch '$EXPECTED_BRANCH'."
fi

if [[ "$ALLOW_DIRTY" != "true" ]] && has_tracked_changes; then
  git -C "$ROOT_DIR" status --short --untracked-files=no >&2 || true
  die "Hay cambios tracked locales. Usa --allow-dirty si queres continuar de todos modos."
fi

cd "$ROOT_DIR"

COMPOSE=(docker compose -f compose.yaml -f compose.prod.yaml --project-directory "$ROOT_DIR")
DOWN_ARGS=(down --remove-orphans)
if [[ "$REMOVE_VOLUMES" == "true" ]]; then
  DOWN_ARGS+=(--volumes)
fi

log "Raiz del repo: $ROOT_DIR"
log "Branch actual: ${CURRENT_BRANCH:-detached}"
if [[ "$DRY_RUN" == "true" ]]; then
  log "Modo dry-run: no se ejecutan comandos del flujo."
fi
if [[ "$SKIP_PULL" == "true" ]]; then
  log "Modo skip-pull: no se ejecutan fetch ni pull."
fi

if [[ "$SKIP_PULL" != "true" ]]; then
  run git fetch origin --prune
fi

run "${COMPOSE[@]}" config -q
confirm_volumes_if_needed
run "${COMPOSE[@]}" "${DOWN_ARGS[@]}"

if [[ "$SKIP_PULL" != "true" ]]; then
  run git pull --ff-only origin "$CURRENT_BRANCH"
fi

run "${COMPOSE[@]}" up -d --build
run "${COMPOSE[@]}" ps

if [[ "$DRY_RUN" == "true" ]]; then
  log "Dry-run finalizado."
else
  log "Deploy refresh finalizado."
fi
