#!/bin/bash

# Cargar variables de entorno del archivo .env
export $(grep -v '^#' ../.env | xargs)
export DB_NAME=epublit_test

api=$(docker compose ps -q "api")

echo "API container id: $api"

# docker stop $(docker ps | grep api-run | awk '{print $1}')

# Levantar el servicio de la base de datos y la API si no están activos
if [ -z $api ]; then
    echo "Starting API service..."
    # el -P es para poder acceder a los puertos
    docker compose run -d -e DB_NAME=epublit_test -P api
else
    echo "API service is already running."
fi

# Cargar datos de prueba solo si la base de datos está lista
echo "Loading test data into MySQL..."
cat ../dbtest/test.sql | docker compose exec -T mysqldb mysql -u root -p$DB_PASS
