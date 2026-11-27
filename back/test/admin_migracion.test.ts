import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sql, eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { librosTable, personasTable, clientesTable, movimientosTable, precioLibrosTable, tiposEdicionTable, usersTable } from '../src/db/schema';

const MIGRACION = readFileSync(join(__dirname, "../db/migrations/0029_red_rhodey.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((sentencia) => sentencia.trim())
    .filter(Boolean);

const ejecutarMigracion = async (): Promise<void> => {
    for (const sentencia of MIGRACION) {
        await db.execute(sql.raw(sentencia));
    }
};

const password = "x".repeat(10);

const insertarUsuario = async (n: number) => {
    const [user] = await db
        .insert(usersTable)
        .values({
            username: `migracion_panel_${n}`,
            password,
            cuit: `20998888${String(n).padStart(3, "0")}`,
            cond_fiscal: "RESPONSABLE INSCRIPTO",
            razon_social: `Migración Panel ${n}`,
            domicilio: "Calle Migración 1",
            fecha_inicio: "01/01/2020",
            email: `migracion-panel-${n}@test.com`,
            email_confirmado: true,
            created_at: null
        })
        .returning({ id: usersTable.id });

    return user.id;
};

const fechaDe = async (columna: string, tabla: string, id: number, idColumna: string): Promise<string | null> => {
    const resultado = await db.execute<{ fecha: string | null }>(
        sql.raw(`SELECT to_char("${columna}", 'YYYY-MM-DD') AS "fecha" FROM "${tabla}" WHERE "${idColumna}" = ${id}`)
    );

    return resultado.rows[0].fecha;
};

let conEvidencia: number;
let conMovimiento: number;
let sinEvidencia: number;
let libroConPrecio: number;
let libroSinPrecio: number;
let personaVieja: number;
let clienteViejo: number;

beforeAll(async () => {
    conEvidencia = await insertarUsuario(1);
    conMovimiento = await insertarUsuario(3);
    sinEvidencia = await insertarUsuario(2);

    // Sólo un movimiento real, sin tokens ni otras fuentes: el alta debe salir
    // de esa fecha y no de la fecha de la migración.
    await db.insert(movimientosTable).values({
        tipo: "ingreso",
        origen_tipo: "exterior",
        destino_tipo: "exterior",
        fecha: new Date("2024-05-10T12:00:00Z"),
        es_migracion: false,
        user: conEvidencia
    });
    await db.insert(movimientosTable).values({
        tipo: "ingreso",
        origen_tipo: "exterior",
        destino_tipo: "exterior",
        fecha: new Date("2024-06-15T12:00:00Z"),
        es_migracion: false,
        user: conMovimiento
    });
    await db.insert(movimientosTable).values({
        tipo: "ingreso",
        origen_tipo: "exterior",
        destino_tipo: "exterior",
        fecha: new Date("2023-01-01T12:00:00Z"),
        es_migracion: true,
        user: sinEvidencia
    });

    const [tipo] = await db
        .insert(tiposEdicionTable)
        .values({ nombre: "Normal", user: conEvidencia })
        .returning({ id: tiposEdicionTable.id });

    const [conPrecio] = await db
        .insert(librosTable)
        .values({
            isbn: "9789800000001",
            titulo: "Libro con precio viejo",
            fecha_edicion: "2020-01-01",
            precio: 100,
            tipo_edicion_id: tipo.id,
            created_at: null,
            user: conEvidencia
        })
        .returning({ id: librosTable.id_libro });
    libroConPrecio = conPrecio.id;

    const [sinPrecio] = await db
        .insert(librosTable)
        .values({
            isbn: "9789800000002",
            titulo: "Libro sin historial",
            fecha_edicion: "2020-01-01",
            precio: 100,
            tipo_edicion_id: tipo.id,
            created_at: null,
            user: conEvidencia
        })
        .returning({ id: librosTable.id_libro });
    libroSinPrecio = sinPrecio.id;

    await db.insert(precioLibrosTable).values({
        isbn: "9789800000001",
        precio: 100,
        created_at: new Date("2023-02-01T12:00:00Z"),
        id_libro: libroConPrecio,
        user: conEvidencia
    });

    const [persona] = await db
        .insert(personasTable)
        .values({ dni: "88888881", nombre: "Persona vieja", user: conEvidencia, created_at: null })
        .returning({ id: personasTable.id });
    personaVieja = persona.id;

    const [cliente] = await db
        .insert(clientesTable)
        .values({
            nombre: "Cliente viejo",
            razon_social: "Cliente viejo",
            cond_fiscal: "CONSUMIDOR FINAL",
            domicilio: "",
            user: conEvidencia,
            created_at: null
        })
        .returning({ id: clientesTable.id });
    clienteViejo = cliente.id;
});

afterAll(() => {
    db.$client.end();
});

describe('migración 0029: rol, altas y backfill', () => {
    test('aplica, completa las altas con evidencia y es idempotente', async () => {
        await ejecutarMigracion();

        expect(await fechaDe("created_at", "users", conEvidencia, "id")).toBe("2023-02-01");
        expect(await fechaDe("created_at", "users", conMovimiento, "id")).toBe("2024-06-15");
        expect(await fechaDe("created_at", "users", sinEvidencia, "id")).toBeNull();
        expect(await fechaDe("created_at", "libros", libroConPrecio, "id_libro")).toBe("2023-02-01");
        expect(await fechaDe("created_at", "libros", libroSinPrecio, "id_libro")).toBeNull();
        expect(await fechaDe("created_at", "personas", personaVieja, "id")).toBeNull();
        expect(await fechaDe("created_at", "clientes", clienteViejo, "id")).toBeNull();

        const primeraAlta = await fechaDe("created_at", "users", conEvidencia, "id");
        const primeraAltaLibro = await fechaDe("created_at", "libros", libroConPrecio, "id_libro");

        await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, conMovimiento));

        await ejecutarMigracion();

        expect(await fechaDe("created_at", "users", conEvidencia, "id")).toBe(primeraAlta);
        expect(await fechaDe("created_at", "users", sinEvidencia, "id")).toBeNull();
        expect(await fechaDe("created_at", "libros", libroConPrecio, "id_libro")).toBe(primeraAltaLibro);
        expect(await fechaDe("created_at", "personas", personaVieja, "id")).toBeNull();
        expect(await fechaDe("created_at", "clientes", clienteViejo, "id")).toBeNull();

        const [conRol] = await db
            .select({ role: usersTable.role })
            .from(usersTable)
            .where(eq(usersTable.id, conMovimiento));
        expect(conRol.role).toBe("admin");
    });

    test('el rol por defecto es editorial y sólo acepta editorial/admin', async () => {
        const [usuario] = await db
            .insert(usersTable)
            .values({
                username: "migracion_panel_nuevo",
                password,
                cuit: "20998888999",
                cond_fiscal: "RESPONSABLE INSCRIPTO",
                razon_social: "Migración Panel Nuevo",
                domicilio: "Calle Migración 2",
                fecha_inicio: "01/01/2020",
                email: "migracion-panel-nuevo@test.com",
                email_confirmado: true
            })
            .returning({ id: usersTable.id, role: usersTable.role, created_at: usersTable.created_at });

        expect(usuario.role).toBe("editorial");
        expect(usuario.created_at).not.toBeNull();

        await expect(
            db.execute(sql`UPDATE "users" SET "role" = 'otro' WHERE "id" = ${usuario.id}`)
        ).rejects.toThrow();
    });

    test('los defaults de las columnas nuevas quedan como los define el schema', async () => {
        const resultado = await db.execute<{ tabla: string; columna: string; default: string | null }>(sql`
            SELECT table_name AS "tabla", column_name AS "columna", column_default AS "default"
            FROM information_schema.columns
            WHERE (table_name = 'users' AND column_name IN ('created_at', 'role'))
               OR (table_name IN ('libros', 'personas', 'clientes') AND column_name = 'created_at')
        `);

        const defaults = new Map(resultado.rows.map((fila) => [`${fila.tabla}.${fila.columna}`, fila.default]));

        expect(defaults.get("users.created_at")).toContain("now()");
        expect(defaults.get("users.role")).toContain("editorial");
        expect(defaults.get("libros.created_at")).toContain("now()");
        expect(defaults.get("personas.created_at")).toContain("now()");
        expect(defaults.get("clientes.created_at")).toContain("now()");
    });
});
