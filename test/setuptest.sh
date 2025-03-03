#!/bin/bash

# Cargar variables de entorno del archivo .env
export $(grep -v '^#' ./.env | xargs)
export DB_NAME=epublit_test

db=$(docker compose ps -q "mysqldb")

# Levantar el servicio de la base de datos si no está activo
if [ -z $db ]; then
    echo "Starting DB service..."
    docker compose up --wait -d mysqldb --remove-orphans
    # el -P es para poder acceder a los puertos
    # docker compose run -d -e DB_NAME=epublit_test -P api
else
    echo "DB service is already running with id: $db"
fi

# Cargar datos de prueba solo si la base de datos está lista
echo "Loading test data into MySQL..."
docker compose cp db/test.sql mysqldb:/
# docker compose exec mysqldb echo $DB_PASS
docker compose exec mysqldb sh -c "mysql -u root -p'$DB_PASS' --quick < /test.sql"
# cat db/test.sql | docker compose exec -T mysqldb mysql -u root -p$DB_PASS
