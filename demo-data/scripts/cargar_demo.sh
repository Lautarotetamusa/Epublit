#!/usr/bin/env bash
# Carga el catálogo demo con SQL y copia las imágenes al FILES_PATH del back.
#
#   ./cargar_demo.sh            # falla si la cuenta demo ya existe
#   ./cargar_demo.sh --reset    # limpia la demo y la vuelve a cargar
#
# Lee la conexión de back/.env. Para apuntar a otro servidor, exportá DB_HOST,
# DB_PORT, DB_USER, DB_PASS y DB_NAME antes de correrlo.
# Para copiar las imágenes a otra ruta, usá DEMO_FILES_PATH.

set -euo pipefail

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACK="$BASE/../back"
RESET=0

if [[ "${1:-}" == "--reset" ]]; then
    RESET=1
fi

if [[ ! -f "$BACK/.env" ]]; then
    echo "No encuentro $BACK/.env"
    exit 1
fi

set -a
# shellcheck disable=SC1091
source "$BACK/.env"
set +a

if ! command -v psql >/dev/null 2>&1; then
    echo "Falta psql (cliente de PostgreSQL)."
    exit 1
fi

run_sql() {
    PGPASSWORD="$DB_PASS" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -v ON_ERROR_STOP=1 \
        -f "$1"
}

if [[ "$RESET" == "1" ]]; then
    echo "Limpiando la cuenta demo..."
    run_sql "$BASE/sql/limpiar_demo.sql"
fi

echo "Cargando demo completa en $DB_NAME@$DB_HOST:$DB_PORT..."
run_sql "$BASE/sql/cargar_demo.sql"

FILES_PATH="${DEMO_FILES_PATH:-${FILES_PATH:-files}}"
if [[ "$FILES_PATH" != /* ]]; then
    FILES_PATH="$BACK/$FILES_PATH"
fi

echo "Copiando imágenes a $FILES_PATH/demo..."
mkdir -p "$FILES_PATH/demo"
cp -R "$BASE/files/demo/." "$FILES_PATH/demo/"

echo ""
echo "Listo. Entrá con usuario \"demo\" y password \"demo12345\"."
