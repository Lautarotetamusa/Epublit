import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
    out: "./db/migrations",
    schema: "./src/schemas",
    dialect: "postgresql",
    dbCredentials: {
        url: env.DATABASE_URL
    }
});
