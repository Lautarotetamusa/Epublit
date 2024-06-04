#/bin/bash

export $(grep -v '^#' .env| xargs)

docker compose stop mysqldb
docker compose up -d mysqldb
docker compose exec mysqldb mysql -u $DB_USER -p$DB_PASS -D $DB_NAME
