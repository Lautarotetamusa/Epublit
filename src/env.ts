import "dotenv/config";
import { z } from "zod";

const strToNumber = (defaultValue: string) =>
    z
        .string()
        .default(defaultValue)
        .transform((val) => Number(val));

const schema = z
    .object({
        HOST: z.string().default("localhost"),
        BACK_PORT: strToNumber("3000"),
        BACK_PUBLIC_PORT: z.string().optional(),
        PROTOCOL: z.string().default("http"),

        JWT_SECRET: z.string(),
        JWT_EXPIRES_IN: z.string().default("24h"),

        DB_HOST: z.string().default("localhost"),
        DB_USER: z.string(),
        DB_PASS: z.string(),
        DB_PORT: z.string(),
        DB_NAME: z.string()
    })
    .transform((env) => ({
        ...env,
        DATABASE_URL: `postgres://${env.DB_USER}:${env.DB_PASS}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`
    }));

export const env = schema.parse(process.env);
