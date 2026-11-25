#!/usr/bin/env bash
# Sube la demo a un servidor por SFTP (scp) y la carga por SSH dentro de Docker.
#
# Uso:
#   SSH_HOST=epublit.com.ar SSH_USER=ubuntu ./desplegar_demo.sh
#   SSH_HOST=epublit.com.ar SSH_USER=ubuntu ./desplegar_demo.sh --reset
#
# Variables principales (todas opcionales salvo SSH_HOST):
#   SSH_HOST              host o alias de ~/.ssh/config (obligatorio)
#   SSH_USER              usuario; si se omite, usa el del alias/host
#   SSH_PORT              puerto SSH; si se omite, usa el de ~/.ssh/config
#   SSH_KEY               ruta a la clave privada
#   REMOTE_PROJECT_DIR    carpeta del docker-compose.yml (default /home/Epublit)
#   REMOTE_TMP            carpeta temporal remota (default /tmp/epublit-demo)
#   COMPOSE_CMD           default "docker compose"; usar "docker-compose" si es v1
#   COMPOSE_FILE          default "docker-compose.yml"
#   DB_SERVICE            servicio de Postgres en el compose (default db)
#   BACK_SERVICE          servicio del back (default back)
#   FILES_PATH            ruta del bind mount de archivos, relativa al proyecto
#                         o absoluta en el host (default files)
#   FILES_MODE            bind (default) o container (volumen nombrado)
#   CONTAINER_FILES_PATH  ruta de archivos dentro del back para FILES_MODE=container
#                         (default /app/files)
#   DOCKER_PREFIX         prefijo para docker, por ejemplo "sudo "
#
# Flags:
#   --reset       corre limpiar_demo.sql antes de cargar
#   --yes         no pide confirmación para --reset
#   --skip-sql    no toca la base; sólo copia imágenes
#   --skip-images no copia imágenes; sólo carga la base
#   --regenerar   corre generar_demo.sh (catálogo, operación y SQL) antes de empaquetar
#   --keep        deja el temporal remoto para inspeccionar
#   --dry-run     muestra los comandos sin ejecutarlos
#   --help        esta ayuda

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_FILE="$BASE/sql/cargar_demo.sql"
CLEAN_FILE="$BASE/sql/limpiar_demo.sql"
IMAGES_DIR="$BASE/files/demo"

SSH_HOST="${SSH_HOST:-}"
SSH_USER="${SSH_USER:-}"
SSH_PORT="${SSH_PORT:-}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/Epublit}"
REMOTE_TMP="${REMOTE_TMP:-/tmp/epublit-demo}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_SERVICE="${DB_SERVICE:-db}"
BACK_SERVICE="${BACK_SERVICE:-back}"
FILES_PATH="${FILES_PATH:-files}"
FILES_MODE="${FILES_MODE:-bind}"
CONTAINER_FILES_PATH="${CONTAINER_FILES_PATH:-/app/files}"
DOCKER_PREFIX="${DOCKER_PREFIX:-}"

RESET=0
ASSUME_YES=0
SKIP_SQL=0
SKIP_IMAGES=0
REGENERAR=0
KEEP=0
DRY_RUN=0

uso() {
    sed -n '2,/^set -euo pipefail$/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --reset) RESET=1 ;;
        --yes) ASSUME_YES=1 ;;
        --skip-sql) SKIP_SQL=1 ;;
        --skip-images) SKIP_IMAGES=1 ;;
        --regenerar) REGENERAR=1 ;;
        --keep) KEEP=1 ;;
        --dry-run) DRY_RUN=1 ;;
        --help|-h) uso; exit 0 ;;
        *)
            echo "Opción desconocida: $1"
            echo "Usá --help para ver las opciones."
            exit 1
            ;;
    esac
    shift
done

if [[ -z "$SSH_HOST" ]]; then
    echo "Falta SSH_HOST. Ejemplo:"
    echo "  SSH_HOST=epublit.com.ar SSH_USER=ubuntu $0"
    exit 1
fi

if [[ "$SKIP_SQL" == "0" && ! -f "$SQL_FILE" ]]; then
    echo "No encuentro $SQL_FILE. Corré scripts/generar_demo.sh primero."
    exit 1
fi

if [[ "$SKIP_IMAGES" == "0" && ! -d "$IMAGES_DIR" ]]; then
    echo "No encuentro $IMAGES_DIR. Corré scripts/generar_demo.sh primero."
    exit 1
fi

SSH_TARGET="${SSH_USER:+$SSH_USER@}$SSH_HOST"
SSH_ARGS=()
SCP_ARGS=()

if [[ -n "$SSH_KEY" ]]; then
    SSH_ARGS+=(-i "$SSH_KEY")
    SCP_ARGS+=(-i "$SSH_KEY")
fi
if [[ -n "$SSH_PORT" ]]; then
    SSH_ARGS+=(-p "$SSH_PORT")
    SCP_ARGS+=(-P "$SSH_PORT")
fi

# `$FILES_PATH` es relativo al proyecto; si viene absoluto, se usa tal cual.
if [[ "$FILES_PATH" == /* ]]; then
    FILES_ABS="$FILES_PATH"
else
    FILES_ABS="$REMOTE_PROJECT_DIR/$FILES_PATH"
fi

remote() {
    if [[ "$DRY_RUN" == "1" ]]; then
        echo "ssh ${SSH_ARGS[*]:-} $SSH_TARGET \"$*\""
        return 0
    fi
    ssh "${SSH_ARGS[@]}" "$SSH_TARGET" "$@"
}

remote_copy() {
    local origen="$1"
    local destino="$2"
    if [[ "$DRY_RUN" == "1" ]]; then
        echo "scp ${SCP_ARGS[*]:-} $origen $SSH_TARGET:$destino"
        return 0
    fi
    scp "${SCP_ARGS[@]}" "$origen" "$SSH_TARGET:$destino"
}

compose() {
    echo "${DOCKER_PREFIX}${COMPOSE_CMD} -f '$COMPOSE_FILE'"
}

sql_command() {
    local archivo="$1"
    local comando
    comando="cd '$REMOTE_PROJECT_DIR' && $(compose) exec -T '$DB_SERVICE' sh -lc 'PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -v ON_ERROR_STOP=1'"
    if [[ "$DRY_RUN" == "1" ]]; then
        echo "ssh ${SSH_ARGS[*]:-} $SSH_TARGET \"$comando\" < $archivo"
        return 0
    fi
    ssh "${SSH_ARGS[@]}" "$SSH_TARGET" "$comando" < "$archivo"
}

if [[ "$RESET" == "1" && "$ASSUME_YES" == "0" && "$DRY_RUN" == "0" ]]; then
    read -r -p "Esto borra el catálogo de la cuenta demo en $SSH_TARGET. ¿Continuar? [s/N] " respuesta
    if [[ ! "$respuesta" =~ ^[sS]$ ]]; then
        echo "Cancelado."
        exit 1
    fi
fi

if [[ "$DRY_RUN" == "1" ]]; then
    echo "--- Demo a desplegar ---"
    echo "Servidor:      $SSH_TARGET"
    echo "Proyecto:      $REMOTE_PROJECT_DIR"
    echo "Compose:       $COMPOSE_CMD -f $COMPOSE_FILE"
    echo "Base:          servicio $DB_SERVICE"
    if [[ "$FILES_MODE" == "container" ]]; then
        echo "Archivos:      contenedor $BACK_SERVICE:$CONTAINER_FILES_PATH/demo"
    else
        echo "Archivos:      bind -> $FILES_ABS"
    fi
    echo "Reset:         $RESET"
    echo ""
fi

if [[ "$REGENERAR" == "1" ]]; then
    echo "Regenerando datos, SQL e imágenes..."
    bash "$BASE/scripts/generar_demo.sh"
fi

# Empaquetar sólo lo necesario: SQL + imágenes.
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
BUNDLE="$TMP_DIR/demo.tar.gz"

INCLUIR=()
if [[ "$SKIP_SQL" == "0" ]]; then
    INCLUIR+=("sql/cargar_demo.sql")
fi
if [[ "$RESET" == "1" && "$SKIP_SQL" == "0" ]]; then
    INCLUIR+=("sql/limpiar_demo.sql")
fi
if [[ "$SKIP_IMAGES" == "0" ]]; then
    INCLUIR+=("files/demo")
fi

if [[ ${#INCLUIR[@]} -eq 0 ]]; then
    echo "No hay nada para hacer: --skip-sql y --skip-images a la vez."
    exit 1
fi

tar -czf "$BUNDLE" -C "$BASE" "${INCLUIR[@]}"

echo "Subiendo paquete a $SSH_TARGET:$REMOTE_TMP ..."
remote "mkdir -p '$REMOTE_TMP'"
remote_copy "$BUNDLE" "$REMOTE_TMP/demo.tar.gz"
remote "tar -xzf '$REMOTE_TMP/demo.tar.gz' -C '$REMOTE_TMP'"

if [[ "$SKIP_SQL" == "0" ]]; then
    if [[ "$RESET" == "1" ]]; then
        echo "Limpiando la demo anterior..."
        sql_command "$CLEAN_FILE"
    fi
    echo "Cargando demo completa en Postgres (servicio $DB_SERVICE)..."
    sql_command "$SQL_FILE"
fi

if [[ "$SKIP_IMAGES" == "0" ]]; then
    if [[ "$FILES_MODE" == "container" ]]; then
        echo "Copiando imágenes al contenedor $BACK_SERVICE:$CONTAINER_FILES_PATH/demo ..."
        remote "cd '$REMOTE_PROJECT_DIR' && $(compose) exec -T '$BACK_SERVICE' rm -rf '$CONTAINER_FILES_PATH/demo'"
        if [[ "$DRY_RUN" == "1" ]]; then
            echo "ssh ${SSH_ARGS[*]:-} $SSH_TARGET \"cd '$REMOTE_PROJECT_DIR' && $(compose) cp '$REMOTE_TMP/files/demo' '$BACK_SERVICE:$CONTAINER_FILES_PATH/demo'\""
        else
            ssh "${SSH_ARGS[@]}" "$SSH_TARGET" "cd '$REMOTE_PROJECT_DIR' && $(compose) cp '$REMOTE_TMP/files/demo' '$BACK_SERVICE:$CONTAINER_FILES_PATH/demo'"
        fi
    else
        echo "Copiando imágenes a $FILES_ABS/demo ..."
        remote "mkdir -p '$FILES_ABS' && rm -rf '$FILES_ABS/demo' && cp -R '$REMOTE_TMP/files/demo' '$FILES_ABS/demo' && chmod -R a+rX '$FILES_ABS/demo'"
    fi
fi

if [[ "$KEEP" == "0" ]]; then
    if [[ "$DRY_RUN" == "0" ]]; then
        remote "rm -rf '$REMOTE_TMP'"
    fi
else
    echo "Temporal remoto conservado en $REMOTE_TMP"
fi

echo ""
echo "Listo. Entrá con usuario \"demo\" y password \"demo12345\"."
