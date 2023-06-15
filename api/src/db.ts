import {createPool, PoolOptions, Pool} from "mysql2/promise"

import * as dotenv from 'dotenv'

dotenv.config();
/*console.log(process.env.DB_HOST);
console.log(process.env.DB_USER);
console.log(process.env.DB_PASS);
console.log(process.env.DB_PORT);
console.log(process.env.DB_NAME);*/

const options:PoolOptions = {
    host:       process.env.DB_HOST,
    user:       process.env.DB_USER,
    password:   process.env.DB_PASS,
    port:       parseInt(process.env.DB_PORT!, 3000), //SI no existe usamos el 3000
    database:   process.env.DB_NAME
  }

export var conn: Pool = createPool(options);