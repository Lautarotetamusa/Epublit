#!/usr/bin/env bash
# Dropea y recrea la DB de test, la migra y la seedea. Los tests corren
# siempre contra estos mismos datos (ver seeders/data.ts: todo determinístico
# por índice) — nada de crear/borrar datos ad-hoc dentro de un test.
set -euo pipefail

cd "$(dirname "$0")/.."

# Mismas credenciales que .env, sólo cambia el nombre de la DB.
set -a
source .env
set +a

TEST_DB_NAME="${TEST_DB_NAME:-${DB_NAME}_test}"
export PGPASSWORD="$DB_PASS"

echo "Recreando $TEST_DB_NAME..."
# --force corta cualquier conexión colgada de una corrida anterior antes de
# dropear: sin esto, una conexión zombie puede sobrevivir al reset y seguir
# escribiendo contra la base recién creada.
dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists --force "$TEST_DB_NAME"
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB_NAME"

echo "Migrando..."
DB_NAME="$TEST_DB_NAME" npx drizzle-kit migrate

echo "Seedeando..."
DB_NAME="$TEST_DB_NAME" npx ts-node seeders/index.ts

echo "Listo: $TEST_DB_NAME con datos de seed."
