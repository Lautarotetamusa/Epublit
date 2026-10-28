#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Backup comprimido (formato custom de pg_dump) de la base de producción.
#
#   ./scripts/backup-db.sh
#
# Deja el archivo en infra/backups/ y rota los últimos 14.
# Los archivos subidos (logos, portadas, fotos, etiquetas) y las claves AFIP
# viven en el host (files/ y afipkeys/) y se respaldan aparte, ver README.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

mkdir -p backups
OUT="backups/epublit_$(date +%Y%m%d_%H%M%S).dump"

docker compose -f docker-compose.yml exec -T db \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${OUT}"

echo "Backup OK: ${OUT} ($(du -h "${OUT}" | cut -f1))"

# Rotación: conservar los 14 más nuevos.
ls -1t backups/epublit_*.dump 2>/dev/null | tail -n +15 | xargs -r rm --
