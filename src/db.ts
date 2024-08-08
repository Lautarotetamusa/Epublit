import { createPool } from "mysql2/promise";
import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../../.env");
dotenv.config({path: path});

console.log("DB_NAME:", process.env.DB_NAME);

const options = {
    host:       process.env.DB_HOST,
    user:       process.env.DB_USER,
    password:   process.env.DB_PASS,
    port:       Number(process.env.DB_PORT) || 3306, 
    database:   process.env.DB_NAME
  }

export const conn = createPool(options);
