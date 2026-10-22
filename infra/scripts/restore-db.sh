#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Restaura un backup de pg_dump (formato custom) sobre la base de producción.
#
#   ./scripts/restore-db.sh backups/epublit_20261022_160000.dump
#
# ¡REEMPLAZA el contenido actual! Pide confirmación explícita.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

FILE="${1:-}"
if [ -z "${FILE}" ] || [ ! -f "${FILE}" ]; then
    echo "Uso: ./scripts/restore-db.sh backups/archivo.dump" >&2
    exit 1
fi

echo "Se va a REEMPLAZAR la base '${DB_NAME}' con ${FILE}."
read -r -p "Escribí 'restaurar' para confirmar: " CONFIRMA
if [ "${CONFIRMA}" != "restaurar" ]; then
    echo "Cancelado."
    exit 1
fi

docker compose -f docker-compose.yml exec -T db \
    pg_restore -U "${DB_USER}" -d "${DB_NAME}" \
    --clean --if-exists --no-owner --single-transaction < "${FILE}"

echo "Restore OK. Reiniciando el back para limpiar conexiones:"
docker compose -f docker-compose.yml restart back
