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

const DEV_CREDENTIALS_KEY = "dev-epublit-credentials-key-change-me";

type ProductionIssue = { variable: string; message: string };

type ProductionConfig = {
    HOST: string;
    PUBLIC_API_URL: string;
    TRUST_PROXY?: number;
    JWT_SECRET: string;
    CREDENTIALS_ENCRYPTION_KEY: string;
    MP_CLIENT_ID: string;
    MP_CLIENT_SECRET: string;
    MP_REDIRECT_URI: string;
    MP_WEBHOOK_SECRET: string;
    MP_PANEL_URL: string;
};

const isPublicHttpsUrl = (value: string): boolean => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
};

const missing = (value: string) => value.trim() === "";

// Sin estas variables el back arranca igual pero la tienda falla en silencio
// (ej. un notification_url con localhost: los pedidos nunca pasan a pagado),
// así que en producción se corta el arranque.
const productionIssues = (env: ProductionConfig): ProductionIssue[] => {
    const issues: ProductionIssue[] = [];
    const check = (variable: string, ok: boolean, message: string) => {
        if (!ok) issues.push({ variable, message });
    };

    check("HOST", isPublicHttpsUrl(env.HOST), "tiene que ser una URL https pública");
    check(
        "PUBLIC_API_URL",
        missing(env.PUBLIC_API_URL) || isPublicHttpsUrl(env.PUBLIC_API_URL),
        "tiene que ser una URL https pública (MercadoPago manda los webhooks ahí)"
    );
    check("TRUST_PROXY", env.TRUST_PROXY !== undefined, "indicá cuántos proxies hay delante del back (0 si ninguno)");

    check(
        "CREDENTIALS_ENCRYPTION_KEY",
        env.CREDENTIALS_ENCRYPTION_KEY !== DEV_CREDENTIALS_KEY && env.CREDENTIALS_ENCRYPTION_KEY.length >= 32,
        "tiene que ser un secreto real de al menos 32 caracteres"
    );
    check(
        "CREDENTIALS_ENCRYPTION_KEY",
        env.CREDENTIALS_ENCRYPTION_KEY !== env.JWT_SECRET,
        "tiene que ser distinta de JWT_SECRET"
    );

    check("MP_CLIENT_ID", !missing(env.MP_CLIENT_ID), "falta el Client ID de la aplicación de MercadoPago");
    check("MP_CLIENT_SECRET", !missing(env.MP_CLIENT_SECRET), "falta el Client Secret de la aplicación de MercadoPago");
    check(
        "MP_CLIENT_SECRET",
        !/^(APP_USR|TEST)-/.test(env.MP_CLIENT_SECRET),
        "parece un Access Token; va el Client Secret de la aplicación"
    );
    check("MP_WEBHOOK_SECRET", !missing(env.MP_WEBHOOK_SECRET), "falta la clave secreta de Webhooks (modo productivo)");
    check("MP_REDIRECT_URI", isPublicHttpsUrl(env.MP_REDIRECT_URI), "tiene que ser una URL https pública");
    check("MP_PANEL_URL", isPublicHttpsUrl(env.MP_PANEL_URL), "tiene que ser una URL https pública");

    return issues;
};

const schema = z
    .object({
        // Entorno de ejecución del proceso (ver .env y Dockerfile).
        NODE_ENV: z.enum(NODE_ENVS).default("dev"),

        PORT: strToNumber("3000"),  // Puerto interno de Express

        // Ruta completa del host. en prod eg: https://example.com/
        HOST: z.string().default("http://localhost:3000"),
        // Base pública de la API cuando hay un proxy con prefijo (ej.
        // https://example.com/api). Si está vacía se usa HOST.
        PUBLIC_API_URL: z.string().default(""),

        // Cantidad de proxies delante del back (nginx). Express la usa para
        // tomar la IP real del cliente de X-Forwarded-For; sin ella el rate
        // limit de la tienda vería a todos los compradores como la misma IP.
        TRUST_PROXY: z.coerce.number().int().min(0).optional(),

        // Orígenes permitidos para CORS, separados por coma (ver
        // src/app.ts). Nunca abierto a cualquier origen.
        CORS_ORIGIN: z.string().default("http://localhost:5173"),

        // Carpeta donde se guardan/sirven los archivos generados (facturas,
        // remitos, logos) — relativa al cwd del proceso.
        FILES_PATH: z.string().default("files"),

        JWT_SECRET: z.string(),
        JWT_EXPIRES_IN: z.string().default("24h"),

        // Clave con la que se cifran tokens de MercadoPago y credenciales de
        // Correo Argentino (AES-256-GCM). En producción debe ser un secreto
        // largo y distinto de JWT_SECRET.
        CREDENTIALS_ENCRYPTION_KEY: z
            .string()
            .min(16)
            .default(DEV_CREDENTIALS_KEY),

        // MercadoPago: app global. Los tokens son por cuenta y viven cifrados.
        MP_CLIENT_ID: z.string().default(""),
        MP_CLIENT_SECRET: z.string().default(""),
        MP_REDIRECT_URI: z.string().default(""),
        MP_WEBHOOK_SECRET: z.string().default(""),
        MP_API_BASE_URL: z.string().default("https://api.mercadopago.com"),
        MP_AUTH_BASE_URL: z.string().default("https://auth.mercadopago.com"),
        // A dónde vuelve el navegador al terminar el OAuth.
        MP_PANEL_URL: z.string().default("http://localhost:5173"),

        // Correo Argentino: base de cada API (producción por defecto; QA se
        // configura por entorno sin tocar código).
        MICORREO_BASE_URL: z.string().default("https://api.correoargentino.com.ar/micorreo/v1"),
        PAQAR_BASE_URL: z.string().default("https://api.correoargentino.com.ar/paqar/v1"),

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
    .superRefine((value, ctx) => {
        if (value.NODE_ENV !== "prod") return;

        for (const issue of productionIssues(value)) {
            ctx.addIssue({ code: "custom", path: [issue.variable], message: issue.message });
        }
    })
    .transform((env) => ({
        ...env,
        PUBLIC_API_URL: env.PUBLIC_API_URL || env.HOST,
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
