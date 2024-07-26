import { createPool } from "mysql2/promise";
import * as dotenv from 'dotenv';
import { join } from "path";

const path = "../.env";
dotenv.config({path: path});

const options = {
    host:       process.env.DB_HOST,
    user:       process.env.DB_USER,
    password:   process.env.DB_PASS,
    port:       Number(process.env.DB_PORT) || 3306, 
    database:   process.env.DB_NAME
}

const pool = createPool(options);

(async () => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try{
        const [rows] = await connection.query("SELECT * FROM user");
        connection.commit();
        console.log(rows.length);
    }catch(e){
        connection.release();
        await connection.rollback();
        console.log(connection);
        console.log("rollback");
    }finally{
        connection.release();
    }

    const [rows] = await connection.query("SELECT * FROM users");
    console.log(rows.length);

})().then(console.log("end"));
