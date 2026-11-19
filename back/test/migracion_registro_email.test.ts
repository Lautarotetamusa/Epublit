import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import fs from "fs";
import os from "os";
import { join } from "path";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { env } from '../src/env';

// La migración 0027 se prueba sobre una base propia (no la de test, que ya
// está migrada): se migra hasta la 0026, se cargan cuentas "viejas" y recién
// ahí se aplica la 0027, igual que va a pasar en producción.
const MIGRACIONES = join(__dirname, "../db/migrations");
const MIGRACION = join(MIGRACIONES, "0027_usuarios_email_confirmado.sql");
const BASE = `${env.DB_NAME}_migracion_0027`;

const conectar = async (database: string) => {
    const client = new Client({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASS, database });
    await client.connect();
    return client;
};

// Copia de la carpeta de migraciones con el journal cortado: drizzle sólo
// aplica lo que figura en el journal.
const migracionesHasta = (ultimoIdx: number): string => {
    const destino = fs.mkdtempSync(join(os.tmpdir(), "epublit-migraciones-"));
    fs.cpSync(MIGRACIONES, destino, { recursive: true });

    const journalPath = join(destino, "meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx <= ultimoIdx);
    fs.writeFileSync(journalPath, JSON.stringify(journal));

    return destino;
};

let admin: Client;
let base: Client;

const recrearBaseEn0026 = async () => {
    await base?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${BASE}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${BASE}"`);
    base = await conectar(BASE);
    await migrate(drizzle(base), { migrationsFolder: migracionesHasta(26) });
};

const migrarA0027 = () => migrate(drizzle(base), { migrationsFolder: MIGRACIONES });

const insertarCuenta = (username: string, email: string | null) =>
    base.query(
        `INSERT INTO users (username, password, cuit, cond_fiscal, razon_social, domicilio, fecha_inicio, email)
         VALUES ($1, 'hash', '20300000013', '', '', '', '', $2)`,
        [username, email]
    );

const columnasDeUsers = async (): Promise<string[]> => {
    const { rows } = await base.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
    return rows.map((row) => row.column_name).sort();
};

const fotoDeLaBase = async () => ({
    columnas: await columnasDeUsers(),
    usuarios: (await base.query(`SELECT * FROM users ORDER BY id`)).rows,
    tablaDeTokens: (await base.query(`SELECT to_regclass('tokens_cuenta') AS tabla`)).rows[0].tabla
});

beforeAll(async () => {
    admin = await conectar("postgres");
});

afterAll(async () => {
    await base?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${BASE}" WITH (FORCE)`);
    await admin.end();
});

describe('migración 0027: email y username únicos, estado de confirmación', () => {
    beforeEach(recrearBaseEn0026);

    test('las cuentas existentes quedan confirmadas y como viejas', async () => {
        await insertarCuenta("caro", "caro@editorial.test");
        await insertarCuenta("sin_email", null);

        await migrarA0027();

        const { rows } = await base.query(`SELECT email_confirmado, username_interno FROM users`);
        expect(rows).toEqual([
            { email_confirmado: true, username_interno: false },
            { email_confirmado: true, username_interno: false }
        ]);
    });

    test('el email es único sin distinguir mayúsculas, salvo vacíos y NULL', async () => {
        await migrarA0027();

        await insertarCuenta("ana", "Ana@x.com");
        await expect(insertarCuenta("ana2", "ana@x.com")).rejects.toThrow(/users_email_lower_idx/);

        await insertarCuenta("vacio1", "");
        await insertarCuenta("vacio2", "");
        await insertarCuenta("nulo1", null);
        await insertarCuenta("nulo2", null);
    });

    test('el username es único sin distinguir mayúsculas', async () => {
        await migrarA0027();

        await insertarCuenta("Caro", null);
        await expect(insertarCuenta("caro", null)).rejects.toThrow(/users_username_lower_idx/);
    });

    test('con emails duplicados falla con un mensaje claro y no cambia nada', async () => {
        await insertarCuenta("caro", "caro@editorial.test");
        await insertarCuenta("feriaros", "CARO@editorial.test");
        const antes = await fotoDeLaBase();

        await expect(migrarA0027()).rejects.toThrow(/emails duplicados.*resolvelos antes/);

        expect(await fotoDeLaBase()).toEqual(antes);
    });

    test('con usernames duplicados falla con un mensaje claro y no cambia nada', async () => {
        await insertarCuenta("Caro", "caro@editorial.test");
        await insertarCuenta("caro", "otra@editorial.test");
        const antes = await fotoDeLaBase();

        await expect(migrarA0027()).rejects.toThrow(/usernames duplicados.*resolvelos antes/);

        expect(await fotoDeLaBase()).toEqual(antes);
    });
});

describe('archivo de la migración 0027', () => {
    test('no contiene direcciones de email', () => {
        expect(fs.readFileSync(MIGRACION, "utf8")).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    });

    test('no menciona usernames de cuentas: sólo nombres de tablas, columnas e índices', () => {
        const literales = [...fs.readFileSync(MIGRACION, "utf8").matchAll(/'([^']*)'/g)].map((match) => match[1]);

        expect(literales.filter((literal) => !/^(|confirmar_email|restablecer_contrasena|Hay (emails|usernames) duplicados.*)$/.test(literal))).toEqual([]);
    });
});
