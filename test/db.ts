import { createPool } from "mysql2/promise";
import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

const options = {
    host:       process.env.DB_HOST,
    user:       process.env.DB_USER,
    password:   process.env.DB_PASS,
    port:       Number(process.env.DB_PORT) || 3306, 
    database:   "epublit_test"
  }
console.log("DB_NAME:", options.database);

export const conn = createPool(options);
