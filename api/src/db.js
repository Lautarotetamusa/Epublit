import {createPool} from "mysql2/promise"

import dotenv from 'dotenv'

dotenv.config();
/*console.log(process.env.DB_HOST);
console.log(process.env.DB_USER);
console.log(process.env.DB_PASS);
console.log(process.env.DB_PORT);
console.log(process.env.DB_NAME);*/

export var conn = createPool({
    host:       process.env.DB_HOST,
    user:       process.env.DB_USER,
    password:   process.env.DB_PASS,
    port:       process.env.DB_PORT,
    database:   process.env.DB_NAME
});