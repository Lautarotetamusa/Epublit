import { sql, SQL } from "drizzle-orm";
import { Database } from "../../db/client";
import { ilikeSinAcentos, ordenAlfabetico } from "../../lib/sql/search";
import { FiltrosCuentas, POR_PAGINA } from "./admin.validator";

export type Ventana = { desde: Date; hasta: Date };

export type ResumenAdmin = {
    cuentas: number;
    nuevas30d: number;
    activas30d: number;
    conLibro: number;
    conVenta: number;
    arcaConectado: number;
};

export type CuentaListado = {
    id: number;
    razonSocial: string;
    email: string | null;
    alta: string | null;
    ultimaOperacion: string | null;
    ultimoIngreso: string | null;
    operaciones30d: number;
    libros: number;
    ventas30d: number;
    arcaConectado: boolean;
    estado: "activo" | "inactivo";
    primeraFechaLibro: string | null;
    primeraFechaMovimiento: string | null;
    ventaHistorica: boolean;
};

export type CuentaSerie = {
    alta: string | null;
    tieneLibro: boolean;
    primeraFechaLibro: string | null;
    primeraFechaMovimiento: string | null;
};

export type ListadoCuentas = {
    cuentas: CuentaListado[];
    total: number;
};

// Las operaciones se guardan como `timestamp` sin zona con la hora UTC; para
// leerlas en el calendario argentino se les declara primero la zona UTC.
const fechaLocal = (columna: SQL): SQL<string | null> =>
    sql<string | null>`to_char((${columna} AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD')`;

// Drizzle/pg serializan un `Date` de un `sql` crudo con el offset local del
// proceso; las columnas de operaciones son UTC. Se compara con la
// representación UTC explícita para no desplazar la ventana según la zona del
// servidor.
const timestampUtc = (fecha: Date): SQL => sql`${fecha.toISOString().replace("T", " ").replace("Z", "")}::timestamp`;

const usuariosCte = sql`usuarios AS (
    SELECT "id", "razon_social", "email", "production", "created_at", "last_login_at"
    FROM "users"
    WHERE "email_confirmado" = true
)`;

// Universo de operaciones de negocio: una fila por acción con fecha. No entran
// login, configuración, comprobantes, ediciones ni filas derivadas (precio,
// líneas, depósitos, bloques). El contenido cuenta una vez por página, en su
// última edición. El cliente genérico creado junto con la cuenta no es alta.
const operacionesCte = sql`operaciones AS (
    SELECT "user", "fecha" FROM "movimientos" WHERE "es_migracion" = false
    UNION ALL
    SELECT "user", "creado_en" FROM "pedidos"
    UNION ALL
    SELECT "user", "created_at" FROM "libro_resenas"
    UNION ALL
    SELECT "user", GREATEST("creada_en", "actualizada_en") FROM "contenido_paginas"
    UNION ALL
    SELECT "user", "fecha_generacion" FROM "liquidaciones"
    UNION ALL
    SELECT "user", "created_at" FROM "libros" WHERE "created_at" IS NOT NULL
    UNION ALL
    SELECT "user", "created_at" FROM "personas" WHERE "created_at" IS NOT NULL
    UNION ALL
    SELECT c."user", c."created_at"
    FROM "clientes" c
    WHERE c."created_at" IS NOT NULL
      AND c."nombre" NOT IN ('MOSTRADOR', 'CONSUMIDOR FINAL')
)`;

const opsAgregadasCte = ({ desde, hasta }: Ventana) => sql`ops_agg AS (
    SELECT
        "user",
        count(*) FILTER (WHERE "fecha" >= ${timestampUtc(desde)} AND "fecha" <= ${timestampUtc(hasta)})::int AS "operaciones_30d",
        max("fecha") FILTER (WHERE "fecha" <= ${timestampUtc(hasta)}) AS "ultima_operacion"
    FROM "operaciones"
    GROUP BY "user"
)`;

const ventasAgregadasCte = ({ desde, hasta }: Ventana) => sql`ventas_agg AS (
    SELECT
        "user",
        count(*) FILTER (WHERE "fecha" >= ${timestampUtc(desde)} AND "fecha" <= ${timestampUtc(hasta)})::int AS "ventas_30d",
        bool_or(true) AS "venta_historica"
    FROM "movimientos"
    WHERE "tipo" IN ('venta', 'ventaConsignacion') AND "es_migracion" = false
    GROUP BY "user"
)`;

const librosAgregadosCte = sql`libros_agg AS (
    SELECT "user", count(*)::int AS "libros", MIN("created_at") AS "primera_fecha_libro"
    FROM "libros"
    GROUP BY "user"
)`;

const movimientosAgregadosCte = sql`movs_agg AS (
    SELECT "user", MIN("fecha") AS "primera_fecha_movimiento"
    FROM "movimientos"
    WHERE "es_migracion" = false
    GROUP BY "user"
)`;

const condicionesListado = (filtros: FiltrosCuentas): SQL[] => {
    const condiciones: SQL[] = [];

    if (filtros.q) {
        const razonSocial = sql`u."razon_social"`;
        const email = sql`coalesce(u."email", '')`;
        condiciones.push(
            sql`(${ilikeSinAcentos(razonSocial, filtros.q)} OR ${ilikeSinAcentos(email, filtros.q)})`
        );
    }
    if (filtros.estado) {
        condiciones.push(
            filtros.estado === "activo"
                ? sql`coalesce(o."operaciones_30d", 0) > 0`
                : sql`coalesce(o."operaciones_30d", 0) = 0`
        );
    }
    if (filtros.arca) {
        condiciones.push(filtros.arca === "con" ? sql`u."production" = true` : sql`u."production" = false`);
    }

    return condiciones;
};

const whereListado = (filtros: FiltrosCuentas): SQL => {
    const condiciones = condicionesListado(filtros);
    return condiciones.length === 0 ? sql`true` : sql.join(condiciones, sql` AND `);
};

export type AdminRepositoryDeps = {
    db: Database;
};

export function createAdminRepository({ db }: AdminRepositoryDeps) {
    const resumen = async (ventana: Ventana): Promise<ResumenAdmin> => {
        const resultado = await db.execute<{
            cuentas: number;
            nuevas30d: number;
            activas30d: number;
            con_libro: number;
            con_venta: number;
            arca_conectado: number;
        }>(sql`
            WITH ${usuariosCte}, ${operacionesCte}
            SELECT
                (SELECT count(*) FROM "usuarios")::int AS "cuentas",
                (SELECT count(*) FROM "usuarios" WHERE "created_at" >= ${timestampUtc(ventana.desde)} AND "created_at" <= ${timestampUtc(ventana.hasta)})::int AS "nuevas30d",
                (SELECT count(*) FROM "usuarios" u WHERE EXISTS (
                    SELECT 1 FROM "operaciones" o
                    WHERE o."user" = u."id" AND o."fecha" >= ${timestampUtc(ventana.desde)} AND o."fecha" <= ${timestampUtc(ventana.hasta)}
                ))::int AS "activas30d",
                (SELECT count(*) FROM "usuarios" u WHERE EXISTS (
                    SELECT 1 FROM "libros" l WHERE l."user" = u."id"
                ))::int AS "con_libro",
                (SELECT count(*) FROM "usuarios" u WHERE EXISTS (
                    SELECT 1 FROM "movimientos" m
                    WHERE m."user" = u."id" AND m."tipo" IN ('venta', 'ventaConsignacion') AND m."es_migracion" = false
                ))::int AS "con_venta",
                (SELECT count(*) FROM "usuarios" WHERE "production" = true)::int AS "arca_conectado"
        `);

        const fila = resultado.rows[0];
        return {
            cuentas: fila.cuentas,
            nuevas30d: fila.nuevas30d,
            activas30d: fila.activas30d,
            conLibro: fila.con_libro,
            conVenta: fila.con_venta,
            arcaConectado: fila.arca_conectado
        };
    };

    const listar = async (ventana: Ventana, filtros: FiltrosCuentas): Promise<ListadoCuentas> => {
        const where = whereListado(filtros);
        const offset = (filtros.pagina - 1) * POR_PAGINA;

        const [totalResultado, cuentasResultado] = await Promise.all([
            db.execute<{ total: number }>(sql`
                WITH ${usuariosCte}, ${operacionesCte}, ${opsAgregadasCte(ventana)}
                SELECT count(*)::int AS "total"
                FROM "usuarios" u
                LEFT JOIN "ops_agg" o ON o."user" = u."id"
                WHERE ${where}
            `),
            db.execute<CuentaListado>(sql`
                WITH ${usuariosCte}, ${operacionesCte}, ${opsAgregadasCte(ventana)},
                     ${librosAgregadosCte}, ${movimientosAgregadosCte}, ${ventasAgregadasCte(ventana)}
                SELECT
                    u."id",
                    u."razon_social" AS "razonSocial",
                    u."email",
                    ${fechaLocal(sql`u."created_at"`)} AS "alta",
                    ${fechaLocal(sql`o."ultima_operacion"`)} AS "ultimaOperacion",
                    ${fechaLocal(sql`u."last_login_at"`)} AS "ultimoIngreso",
                    coalesce(o."operaciones_30d", 0) AS "operaciones30d",
                    coalesce(l."libros", 0) AS "libros",
                    coalesce(v."ventas_30d", 0) AS "ventas30d",
                    u."production" AS "arcaConectado",
                    CASE WHEN coalesce(o."operaciones_30d", 0) > 0 THEN 'activo' ELSE 'inactivo' END AS "estado",
                    ${fechaLocal(sql`l."primera_fecha_libro"`)} AS "primeraFechaLibro",
                    ${fechaLocal(sql`m."primera_fecha_movimiento"`)} AS "primeraFechaMovimiento",
                    coalesce(v."venta_historica", false) AS "ventaHistorica"
                FROM "usuarios" u
                LEFT JOIN "ops_agg" o ON o."user" = u."id"
                LEFT JOIN "libros_agg" l ON l."user" = u."id"
                LEFT JOIN "movs_agg" m ON m."user" = u."id"
                LEFT JOIN "ventas_agg" v ON v."user" = u."id"
                WHERE ${where}
                ORDER BY ${ordenAlfabetico(sql`u."razon_social"`)}, ${ordenAlfabetico(sql`coalesce(u."email", '')`)}, u."id"
                LIMIT ${POR_PAGINA} OFFSET ${offset}
            `)
        ]);

        return {
            cuentas: cuentasResultado.rows,
            total: totalResultado.rows[0].total
        };
    };

    // Base de la composición mensual: por cuenta confirmada, su alta y las
    // primeras fechas de libro y movimiento. Se resuelve con agregados, sin
    // traer el historial de operaciones.
    const baseSerie = async (): Promise<CuentaSerie[]> => {
        const resultado = await db.execute<CuentaSerie>(sql`
            WITH ${usuariosCte}, ${librosAgregadosCte}, ${movimientosAgregadosCte}
            SELECT
                ${fechaLocal(sql`u."created_at"`)} AS "alta",
                coalesce(l."libros", 0) > 0 AS "tieneLibro",
                ${fechaLocal(sql`l."primera_fecha_libro"`)} AS "primeraFechaLibro",
                ${fechaLocal(sql`m."primera_fecha_movimiento"`)} AS "primeraFechaMovimiento"
            FROM "usuarios" u
            LEFT JOIN "libros_agg" l ON l."user" = u."id"
            LEFT JOIN "movs_agg" m ON m."user" = u."id"
        `);

        return resultado.rows;
    };

    return { resumen, listar, baseSerie };
}

export type AdminRepository = ReturnType<typeof createAdminRepository>;
