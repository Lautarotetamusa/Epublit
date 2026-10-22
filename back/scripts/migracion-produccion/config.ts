import "dotenv/config";

export const CUENTAS_A_MIGRAR = [1, 3, 4, 5, 6, 21, 22, 24] as const;

export const FECHA_SOFT_DELETE = "2026-10-22";

export const FECHA_APERTURA_SIN_MOVIMIENTOS = "2000-01-01 00:00:00";

export const NOMBRE_DEPOSITO_PRINCIPAL = "Depósito principal";

export const ROLES_POR_DEFECTO = ["autor", "ilustrador"] as const;

export const MEDIOS_PAGO_POR_DEFECTO = [
    "efectivo",
    "debito",
    "credito",
    "mercadopago",
    "transferencia"
] as const;

// Nunca se resetean: son bases de la app, no un destino de rehearsal.
const BASES_PROTEGIDAS = new Set(["epublit", "epublit_test", "postgres", "template0", "template1"]);

export type MysqlConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

export type PostgresConfig = {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
};

export type MigracionConfig = {
    mysql: MysqlConfig;
    postgres: PostgresConfig;
    cuentas: readonly number[];
    permitirDestinoNoRehearsal: boolean;
};

const texto = (value: string | undefined, defaultValue: string): string => value ?? defaultValue;

const numero = (value: string | undefined, defaultValue: number): number => {
    const parsed = Number(value ?? defaultValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Puerto inválido: "${value}"`);
    }
    return parsed;
};

function crearMysqlConfig(): MysqlConfig {
    return {
        host: texto(process.env.MYSQL_HOST, "127.0.0.1"),
        port: numero(process.env.MYSQL_PORT, 3307),
        user: texto(process.env.MYSQL_USER, "root"),
        password: texto(process.env.MYSQL_PASSWORD, "root"),
        database: texto(process.env.MYSQL_DATABASE, "epublit_prod")
    };
}

function crearPostgresConfig(): PostgresConfig {
    return {
        host: texto(process.env.MIGRACION_DB_HOST, texto(process.env.DB_HOST, "localhost")),
        port: numero(process.env.MIGRACION_DB_PORT, numero(process.env.DB_PORT, 5432)),
        user: texto(process.env.MIGRACION_DB_USER, texto(process.env.DB_USER, "postgres")),
        password: texto(process.env.MIGRACION_DB_PASSWORD, texto(process.env.DB_PASS, "")),
        database: texto(process.env.MIGRACION_DB_NAME, texto(process.env.DB_NAME, "epublit"))
    };
}

function validarDestino(postgres: PostgresConfig, permitirDestinoNoRehearsal: boolean): void {
    if (postgres.database.endsWith("_migracion")) return;
    if (permitirDestinoNoRehearsal) return;
    throw new Error(
        `Destino inseguro: "${postgres.database}" no termina en _migracion. ` +
            "Corré con DB_NAME=epublit_migracion o seteá MIGRACION_ALLOW_TARGET=1."
    );
}

export function esBaseProtegida(database: string): boolean {
    return BASES_PROTEGIDAS.has(database);
}

export function crearConfig(): MigracionConfig {
    const permitirDestinoNoRehearsal = process.env.MIGRACION_ALLOW_TARGET === "1";
    const postgres = crearPostgresConfig();
    validarDestino(postgres, permitirDestinoNoRehearsal);

    return {
        mysql: crearMysqlConfig(),
        postgres,
        cuentas: CUENTAS_A_MIGRAR,
        permitirDestinoNoRehearsal
    };
}
