import "dotenv/config";
import { z } from "zod";

const strToNumber = (defaultValue: string) =>
    z
        .string()
        .default(defaultValue)
        .transform(Number);

const schema = z
    .object({
        PORT: strToNumber("3000"),  // Puerto interno de Express

        // Ruta completa del host. en prod eg: https://example.com/api/v1/
        HOST: z.string().default("http://localhost:3000"),

        // Orígenes permitidos para CORS, separados por coma (ver
        // src/app.ts). Nunca abierto a cualquier origen.
        CORS_ORIGIN: z.string().default("http://localhost:5173"),

        // Carpeta donde se guardan/sirven los archivos generados (facturas,
        // remitos, logos) — relativa al cwd del proceso.
        FILES_PATH: z.string().default("files"),

        JWT_SECRET: z.string(),
        JWT_EXPIRES_IN: z.string().default("24h"),

        // Cuit de producción usado para consultar el padrón de AFIP
        // (`getAfipData`), independiente del cuit de cada usuario.
        AFIP_CUIT_PROD: z.string().default("27249804024"),

        DB_HOST: z.string().default("localhost"),
        DB_USER: z.string(),
        DB_PASS: z.string(),
        DB_PORT: z.string(),
        DB_NAME: z.string()
    })
    .transform((env) => ({
        ...env,
        DATABASE_URL: `postgres://${env.DB_USER}:${env.DB_PASS}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
    }));

export const env = schema.parse(process.env);
