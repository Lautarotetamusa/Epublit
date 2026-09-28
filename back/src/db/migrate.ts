import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./client";

async function main(): Promise<void> {
    await migrate(db, { migrationsFolder: "db/migrations" });
    console.log("Migraciones aplicadas correctamente");
    process.exit(0);
}

main().catch((err) => {
    console.error("Error aplicando las migraciones:", err);
    process.exit(1);
});
