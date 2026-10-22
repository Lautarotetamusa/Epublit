#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Emite por primera vez el certificado de Let's Encrypt para DOMAIN.
#
# Requisitos:
#   - infra/.env completo (DOMAIN, PUBLIC_URL, LETSENCRYPT_EMAIL...)
#   - imagen del back disponible (docker compose pull back)
#   - puerto 80 accesible desde internet para el challenge HTTP-01
#
# Es idempotente en el sentido de que se puede volver a correr si el
# certificado no existe; si ya existe, certbot lo reutiliza/renueva.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
    echo "Falta infra/.env. Copiá .env.example y completalo." >&2
    exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${DOMAIN:?Falta DOMAIN en infra/.env}"
: "${LETSENCRYPT_EMAIL:?Falta LETSENCRYPT_EMAIL en infra/.env}"

COMPOSE=(docker compose -f docker-compose.yml)
LIVE="/etc/letsencrypt/live/${DOMAIN}"

echo "==> 1/4 · certificado dummy (para que nginx pueda arrancar)"
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "
    apk add --no-cache openssl >/dev/null 2>&1 || true
    mkdir -p '${LIVE}' &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout '${LIVE}/privkey.pem' \
        -out '${LIVE}/fullchain.pem' \
        -subj '/CN=${DOMAIN}'"

echo "==> 2/4 · levantando db, back y nginx"
"${COMPOSE[@]}" up -d db back nginx

echo "==> 3/4 · pidiendo el certificado real a Let's Encrypt"
"${COMPOSE[@]}" run --rm --entrypoint sh certbot -c \
    "rm -rf '/etc/letsencrypt/live/${DOMAIN}' '/etc/letsencrypt/archive/${DOMAIN}' '/etc/letsencrypt/renewal/${DOMAIN}.conf'"

STAGING=""
if [ "${LETSENCRYPT_STAGING:-0}" = "1" ]; then
    STAGING="--staging"
fi

"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    --email "${LETSENCRYPT_EMAIL}" \
    --agree-tos --no-eff-email \
    ${STAGING} \
    -d "${DOMAIN}"

echo "==> 4/4 · recargando nginx"
"${COMPOSE[@]}" exec nginx nginx -s reload

echo
echo "Listo: https://${DOMAIN}"
echo "Renovación: docker compose -f docker-compose.yml up -d certbot"
