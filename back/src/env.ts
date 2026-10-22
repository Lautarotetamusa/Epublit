import "dotenv/config";
import { z } from "zod";
import { isValidCuit } from "./lib/cuit";

const NODE_ENVS = ["dev", "staging", "prod"] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

const strToNumber = (defaultValue: string) =>
    z
        .string()
        .default(defaultValue)
        .transform(Number);

const schema = z
    .object({
        // Entorno de ejecución del proceso (ver .env y Dockerfile).
        NODE_ENV: z.enum(NODE_ENVS).default("dev"),

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
        AFIP_CUIT_PROD: z
            .string()
            .refine(isValidCuit, "debe ser un CUIT de 11 dígitos con dígito verificador válido"),

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

const isNodeEnv = (value: string | undefined): value is NodeEnv =>
    value !== undefined && (NODE_ENVS as readonly string[]).includes(value);

const currentEnvironment = (source: NodeJS.ProcessEnv): NodeEnv =>
    isNodeEnv(source.NODE_ENV) ? source.NODE_ENV : "dev";

const formatIssues = (error: z.ZodError): string =>
    error.issues
        .map((issue) => `  - ${issue.path.join(".") || "(configuración)"}: ${issue.message}`)
        .join("\n");

const buildInvalidNodeEnvError = (value: string, error: z.ZodError) =>
    new Error(
        `NODE_ENV inválido: "${value}". Valores permitidos: ${NODE_ENVS.join(", ")}.\n` +
            `Variables con problemas:\n${formatIssues(error)}`
    );

const buildConfigError = (source: NodeJS.ProcessEnv, error: z.ZodError) => {
    if (source.NODE_ENV !== undefined && !isNodeEnv(source.NODE_ENV)) {
        return buildInvalidNodeEnvError(source.NODE_ENV, error);
    }

    return new Error(
        `Configuración inválida para el entorno "${currentEnvironment(source)}".\n` +
            `Variables con problemas:\n${formatIssues(error)}`
    );
};

const parseEnv = (source: NodeJS.ProcessEnv) => {
    const result = schema.safeParse(source);
    if (!result.success) {
        throw buildConfigError(source, result.error);
    }
    return result.data;
};

export const env = parseEnv(process.env);
