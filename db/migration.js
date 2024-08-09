var mysql = require('mysql2');
var migration = require('mysql-migrations');
var dotenv = require('dotenv');
var path = require('path');

const envPath = path.join(__dirname, "../.env");
dotenv.config({path: envPath});

const options = {
    host:       "localhost",
    user:       process.env.DB_USER,
    password:   process.env.DB_PASS,
    port:       Number(process.env.DB_PORT) || 3306, 
    database:   process.env.DB_NAME,
    multipleStatements: true // Enable multiple statements
}
console.log(options);

const connection = mysql.createPool(options);

migration.init(connection, path.join(__dirname, '../migrations'), function() {}, ["--update-schema"]);
