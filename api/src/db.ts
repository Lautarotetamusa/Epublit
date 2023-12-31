import { createPool } from "mysql2/promise";

import * as dotenv from 'dotenv';

dotenv.config();
/*console.log(process.env.DB_HOST);
console.log(process.env.DB_USER);
console.log(process.env.DB_PASS);
console.log(process.env.DB_PORT);
console.log(process.env.DB_NAME);*/

const port: number = Number(process.env.DB_PORT) ? Number(process.env.DB_PORT) : 3306;

const options = {
    host:       process.env.DB_HOST,
    user:       process.env.DB_USER,
    password:   process.env.DB_PASS,
    port:       port, //SI no existe usamos el 3306,
    database:   process.env.DB_NAME
  }

export var conn = createPool(options);
