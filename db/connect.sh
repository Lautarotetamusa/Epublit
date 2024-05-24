export $(cat .env | xargs)

docker compose up -d mysqldb;
docker compose exec mysqldb mysql -u $DB_USER -p$DB_PASS -D $DB_NAME;
