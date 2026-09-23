import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./schemas";
import { env } from "./env";

const pool = new Pool({
    connectionString: env.DATABASE_URL
});

export const db = drizzle(pool, { schema });

async function testDBConnection() {
    try {
        await db.execute(sql`select 1`);
    } catch (err) {
        console.error("Drizzle (Postgres) no está configurado correctamente", err);
        process.exit(1);
    }
}
testDBConnection();
