#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Sube el .env local al servidor de producción y recrea el back para que tome
# los cambios. El archivo destino es el mismo directorio del compose.
#
#   ./scripts/push-env.sh                 # usa infra/.env
#   ./scripts/push-env.sh otro.env
#
# Requiere SERVER_HOST, SERVER_USER y (opcional) SSH_KEY_PATH.
# APP_DIR default: /home/Epublit
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL_ENV="${1:-.env}"
if [ ! -f "${LOCAL_ENV}" ]; then
    echo "No existe ${LOCAL_ENV}. Copiá .env.example y completalo." >&2
    exit 1
fi

: "${SERVER_HOST:?Falta SERVER_HOST}"
: "${SERVER_USER:?Falta SERVER_USER}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_rsa}"
APP_DIR="${APP_DIR:-/home/Epublit}"

echo "==> Subiendo ${LOCAL_ENV} a ${SERVER_USER}@${SERVER_HOST}:${APP_DIR}/.env"
scp -i "${SSH_KEY_PATH}" "${LOCAL_ENV}" "${SERVER_USER}@${SERVER_HOST}:${APP_DIR}/.env"

echo "==> Ajustando permisos y recreando el back"
ssh -i "${SSH_KEY_PATH}" "${SERVER_USER}@${SERVER_HOST}" \
    "chmod 600 '${APP_DIR}/.env' && cd '${APP_DIR}' && docker compose up -d back"

echo "==> Listo."
echo "    Si cambiaste DOMAIN o PUBLIC_URL, recreá también nginx:"
echo "    ssh -i ${SSH_KEY_PATH} ${SERVER_USER}@${SERVER_HOST} 'cd ${APP_DIR} && docker compose up -d nginx'"
