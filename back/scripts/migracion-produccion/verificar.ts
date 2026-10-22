import { Client } from "pg";
import { AnalisisDatos, mapearFilePath } from "./analisis";
import { PostgresConfig } from "./config";
import { DatosMigracion } from "./tipos";

export type Verificacion = {
    ok: boolean;
    diferencias: string[];
};

type FilaConteo = { n: number };

type FilaVentas = { n: number; total: number };

const MAX_DIFERENCIAS_IMPRESAS = 40;

const formato = (value: number): string => value.toLocaleString("es-AR");

function agregar(diferencias: string[], mensaje: string): void {
    diferencias.push(mensaje);
}

function compararEscalar(
    nombre: string,
    origen: number,
    destino: number,
    diferencias: string[]
): void {
    if (origen !== destino) {
        agregar(diferencias, `${nombre}: origen ${formato(origen)}, destino ${formato(destino)}`);
    }
}

function compararMapa(
    nombre: string,
    origen: Map<string | number, number>,
    destino: Map<string | number, number>,
    diferencias: string[],
    formatearClave: (clave: string | number) => string = String
): void {
    const claves = new Set([...origen.keys(), ...destino.keys()]);
    for (const clave of claves) {
        const esperado = origen.get(clave) ?? 0;
        const obtenido = destino.get(clave) ?? 0;
        if (esperado !== obtenido) {
            agregar(
                diferencias,
                `${nombre} ${formatearClave(clave)}: origen ${formato(esperado)}, destino ${formato(obtenido)}`
            );
        }
    }
}

function contarPor<T>(items: readonly T[], obtenerClave: (item: T) => string): Map<string, number> {
    const mapa = new Map<string, number>();
    for (const item of items) {
        const clave = obtenerClave(item);
        mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    }
    return mapa;
}

async function contarTabla(client: Client, tabla: string): Promise<number> {
    const result = await client.query<FilaConteo>(`SELECT count(*)::int AS n FROM "${tabla}"`);
    return result.rows[0].n;
}

async function contarMovimientos(client: Client): Promise<{ comerciales: number; aperturas: number }> {
    const result = await client.query<{ comerciales: number; aperturas: number }>(
        `SELECT
            count(*) FILTER (WHERE NOT "es_migracion")::int AS comerciales,
            count(*) FILTER (WHERE "es_migracion")::int AS aperturas
         FROM "movimientos"`
    );
    return result.rows[0];
}

async function contarLineasComerciales(client: Client): Promise<number> {
    const result = await client.query<FilaConteo>(
        `SELECT count(*)::int AS n
         FROM "movimientos_libros" ml
         JOIN "movimientos" m ON m."id" = ml."movimiento_id"
         WHERE NOT m."es_migracion"`
    );
    return result.rows[0].n;
}

async function ventasDestino(client: Client): Promise<FilaVentas> {
    const result = await client.query<FilaVentas>(
        `SELECT count(*)::int AS n, COALESCE(sum("total"::float8), 0)::float8 AS total FROM "ventas"`
    );
    return result.rows[0];
}

async function ejemplaresVendidosDestino(client: Client): Promise<number> {
    const result = await client.query<FilaConteo>(
        `SELECT COALESCE(sum(ml."cantidad"), 0)::int AS n
         FROM "movimientos_libros" ml
         JOIN "movimientos" m ON m."id" = ml."movimiento_id"
         WHERE m."tipo" IN ('venta', 'ventaConsignacion') AND NOT m."es_migracion"`
    );
    return result.rows[0].n;
}

async function stockPrincipalDestino(client: Client): Promise<Map<number, number>> {
    const result = await client.query<{ id_libro: number; cantidad: number }>(
        `SELECT dl."id_libro", sum(dl."cantidad")::int AS cantidad
         FROM "deposito_libros" dl
         JOIN "depositos" d ON d."id" = dl."deposito_id" AND d."user" = dl."user"
         WHERE d."principal" AND d."deleted_at" IS NULL
         GROUP BY dl."id_libro"`
    );
    return new Map(result.rows.map((fila) => [fila.id_libro, fila.cantidad]));
}

async function stockClienteDestino(client: Client): Promise<Map<string, number>> {
    const result = await client.query<{ id_libro: number; id_cliente: number; cantidad: number }>(
        `SELECT dl."id_libro", d."id_cliente", sum(dl."cantidad")::int AS cantidad
         FROM "deposito_libros" dl
         JOIN "depositos" d ON d."id" = dl."deposito_id" AND d."user" = dl."user"
         WHERE d."id_cliente" IS NOT NULL
         GROUP BY dl."id_libro", d."id_cliente"`
    );
    return new Map(result.rows.map((fila) => [`${fila.id_cliente}:${fila.id_libro}`, fila.cantidad]));
}

async function fechasMovimientosDestino(client: Client): Promise<Map<string, number>> {
    const result = await client.query<{ fecha: string; n: number }>(
        `SELECT to_char("fecha", 'YYYY-MM-DD HH24:MI:SS') AS fecha, count(*)::int AS n
         FROM "movimientos"
         WHERE NOT "es_migracion"
         GROUP BY 1`
    );
    return new Map(result.rows.map((fila) => [fila.fecha, fila.n]));
}

async function fechasPreciosDestino(client: Client, tabla: string): Promise<Map<string, number>> {
    const result = await client.query<{ fecha: string; n: number }>(
        `SELECT to_char("created_at", 'YYYY-MM-DD HH24:MI:SS') AS fecha, count(*)::int AS n
         FROM "${tabla}"
         GROUP BY 1`
    );
    return new Map(result.rows.map((fila) => [fila.fecha, fila.n]));
}

async function filePathsDestino(client: Client): Promise<Map<string, number>> {
    const result = await client.query<{ path: string; n: number }>(
        `SELECT COALESCE("file_path", '<null>') AS path, count(*)::int AS n
         FROM "movimientos"
         WHERE NOT "es_migracion"
         GROUP BY 1`
    );
    return new Map(result.rows.map((fila) => [fila.path, fila.n]));
}

async function verificarUsuarios(
    client: Client,
    datos: DatosMigracion,
    diferencias: string[]
): Promise<void> {
    const result = await client.query<{ id: number; username: string; password: string }>(
        `SELECT "id", "username", "password" FROM "users" ORDER BY "id"`
    );
    const destino = new Map(result.rows.map((fila) => [fila.id, fila]));

    for (const usuario of datos.users) {
        const fila = destino.get(usuario.id);
        if (!fila) {
            agregar(diferencias, `users ${usuario.id} (${usuario.username}): no existe en el destino`);
            continue;
        }
        if (fila.username !== usuario.username) {
            agregar(diferencias, `users ${usuario.id}: username distinto (${usuario.username} vs ${fila.username})`);
        }
        if (fila.password !== usuario.password) {
            agregar(diferencias, `users ${usuario.id}: el hash de password cambió`);
        }
    }
}

async function verificarIntegridad(client: Client, diferencias: string[]): Promise<void> {
    const ventasSinCliente = await client.query<FilaConteo>(
        `SELECT count(*)::int AS n
         FROM "ventas" v
         LEFT JOIN "clientes" c ON c."id" = v."id_cliente"
         WHERE c."id" IS NULL`
    );
    compararEscalar("ventas con cliente inexistente", 0, ventasSinCliente.rows[0].n, diferencias);

    const ventasCruzadas = await client.query<FilaConteo>(
        `SELECT count(*)::int AS n
         FROM "ventas" v
         JOIN "movimientos" m ON m."id" = v."id_movimiento"
         JOIN "clientes" c ON c."id" = v."id_cliente"
         WHERE c."user" <> m."user"`
    );
    compararEscalar("ventas con cliente de otra cuenta", 0, ventasCruzadas.rows[0].n, diferencias);

    const lineasSinLibro = await client.query<FilaConteo>(
        `SELECT count(*)::int AS n
         FROM "movimientos_libros" ml
         LEFT JOIN "libros" l ON l."id_libro" = ml."id_libro"
         WHERE l."id_libro" IS NULL`
    );
    compararEscalar("líneas con libro inexistente", 0, lineasSinLibro.rows[0].n, diferencias);

    const movimientosSinLineas = await client.query<FilaConteo>(
        `SELECT count(*)::int AS n
         FROM "movimientos" m
         WHERE NOT EXISTS (
             SELECT 1 FROM "movimientos_libros" ml
             WHERE ml."movimiento_id" = m."id" AND ml."user" = m."user"
         )`
    );
    compararEscalar("movimientos sin líneas", 0, movimientosSinLineas.rows[0].n, diferencias);

    const stockNegativo = await client.query<FilaConteo>(
        `SELECT count(*)::int AS n FROM "deposito_libros" WHERE "cantidad" < 0`
    );
    compararEscalar("filas de stock negativo", 0, stockNegativo.rows[0].n, diferencias);
}

async function verificarStock(
    client: Client,
    datos: DatosMigracion,
    diferencias: string[]
): Promise<void> {
    const principal = await stockPrincipalDestino(client);
    const esperadoPrincipal = new Map(datos.libros.map((libro) => [libro.id_libro, libro.stock]));
    compararMapa("stock principal libro", esperadoPrincipal, principal, diferencias);

    const esperadoCliente = new Map(
        datos.libro_cliente.map((fila) => [`${fila.id_cliente}:${fila.id_libro}`, fila.stock])
    );
    const cliente = await stockClienteDestino(client);
    compararMapa("stock cliente", esperadoCliente, cliente, diferencias, (clave) => {
        const [idCliente, idLibro] = String(clave).split(":");
        return `cliente ${idCliente} libro ${idLibro}`;
    });
}

async function verificarFechasYArchivos(
    client: Client,
    datos: DatosMigracion,
    analisis: AnalisisDatos,
    diferencias: string[]
): Promise<void> {
    const fechasOrigen = contarPor(analisis.transaccionesMigrables, (transaccion) => transaccion.fecha);
    compararMapa("fecha de movimiento", fechasOrigen, await fechasMovimientosDestino(client), diferencias);

    const preciosOrigen = contarPor(datos.precio_libros, (precio) => precio.created_at);
    compararMapa(
        "created_at de precio_libros",
        preciosOrigen,
        await fechasPreciosDestino(client, "precio_libros"),
        diferencias
    );

    const preciosClienteOrigen = contarPor(
        datos.precio_libro_cliente,
        (precio) => precio.created_at
    );
    compararMapa(
        "created_at de precio_libro_cliente",
        preciosClienteOrigen,
        await fechasPreciosDestino(client, "precio_libro_cliente"),
        diferencias
    );

    const pathsOrigen = contarPor(analisis.transaccionesMigrables, (transaccion) =>
        mapearFilePath(transaccion.type, transaccion.file_path) ?? "<null>"
    );
    compararMapa("file_path de movimiento", pathsOrigen, await filePathsDestino(client), diferencias);
}

export async function verificarDatos(
    config: PostgresConfig,
    datos: DatosMigracion,
    analisis: AnalisisDatos
): Promise<Verificacion> {
    const client = new Client(config);
    await client.connect();
    const diferencias: string[] = [];

    try {
        const conteos: Array<[string, number, number]> = [
            ["users", datos.users.length, await contarTabla(client, "users")],
            ["clientes", datos.clientes.length, await contarTabla(client, "clientes")],
            ["personas", datos.personas.length, await contarTabla(client, "personas")],
            ["libros", datos.libros.length, await contarTabla(client, "libros")],
            [
                "precio_libros",
                datos.precio_libros.length,
                await contarTabla(client, "precio_libros")
            ],
            [
                "precio_libro_cliente",
                datos.precio_libro_cliente.length,
                await contarTabla(client, "precio_libro_cliente")
            ],
            ["libro_cliente", datos.libro_cliente.length, await contarTabla(client, "libro_cliente")],
            [
                "libros_personas",
                datos.libros_personas.length,
                await contarTabla(client, "libros_personas")
            ]
        ];

        console.log("\nConteos origen vs destino:");
        for (const [nombre, origen, destino] of conteos) {
            compararEscalar(nombre, origen, destino, diferencias);
            console.log(`  ${nombre.padEnd(22)} ${formato(origen).padStart(7)} / ${formato(destino).padStart(7)}`);
        }

        const movimientos = await contarMovimientos(client);
        compararEscalar(
            "movimientos comerciales",
            analisis.transaccionesMigrables.length,
            movimientos.comerciales,
            diferencias
        );
        compararEscalar(
            "movimientos de apertura",
            analisis.resumen.movimientos_apertura_esperados,
            movimientos.aperturas,
            diferencias
        );
        console.log(
            `  movimientos comerciales  ${formato(analisis.transaccionesMigrables.length).padStart(7)} / ${formato(movimientos.comerciales).padStart(7)}`
        );
        console.log(
            `  movimientos de apertura  ${formato(analisis.resumen.movimientos_apertura_esperados).padStart(7)} / ${formato(movimientos.aperturas).padStart(7)}`
        );

        const lineas = await contarLineasComerciales(client);
        compararEscalar(
            "movimientos_libros comerciales",
            datos.libros_transacciones.length,
            lineas,
            diferencias
        );

        const ventas = await ventasDestino(client);
        compararEscalar("ventas", analisis.ventasMigrables.length, ventas.n, diferencias);
        const totalOrigen = analisis.ventasMigrables.reduce((total, venta) => total + venta.total, 0);
        if (Math.abs(totalOrigen - ventas.total) > 0.01) {
            agregar(
                diferencias,
                `sum(ventas.total): origen ${totalOrigen.toFixed(2)}, destino ${ventas.total.toFixed(2)}`
            );
        }
        console.log(
            `  ventas                   ${formato(analisis.ventasMigrables.length).padStart(7)} / ${formato(ventas.n).padStart(7)}` +
                `  (total ${totalOrigen.toFixed(2)})`
        );

        const ejemplares = await ejemplaresVendidosDestino(client);
        compararEscalar(
            "ejemplares vendidos",
            analisis.resumen.ejemplares_vendidos,
            ejemplares,
            diferencias
        );

        const librosBorrados = await client.query<FilaConteo>(
            `SELECT count(*)::int AS n FROM "libros" WHERE "deleted_at" IS NOT NULL`
        );
        compararEscalar(
            "libros con deleted_at",
            datos.libros.filter((libro) => libro.is_deleted).length,
            librosBorrados.rows[0].n,
            diferencias
        );

        const personasBorradas = await client.query<FilaConteo>(
            `SELECT count(*)::int AS n FROM "personas" WHERE "deleted_at" IS NOT NULL`
        );
        compararEscalar(
            "personas con deleted_at",
            datos.personas.filter((persona) => persona.is_deleted).length,
            personasBorradas.rows[0].n,
            diferencias
        );

        await verificarUsuarios(client, datos, diferencias);
        await verificarStock(client, datos, diferencias);
        await verificarFechasYArchivos(client, datos, analisis, diferencias);
        await verificarIntegridad(client, diferencias);
    } finally {
        await client.end();
    }

    console.log("\nDiferencias:");
    if (diferencias.length === 0) {
        console.log("  (ninguna)");
        return { ok: true, diferencias };
    }

    for (const diferencia of diferencias.slice(0, MAX_DIFERENCIAS_IMPRESAS)) {
        console.log(`  - ${diferencia}`);
    }
    if (diferencias.length > MAX_DIFERENCIAS_IMPRESAS) {
        console.log(`  ... y ${diferencias.length - MAX_DIFERENCIAS_IMPRESAS} diferencias más`);
    }
    console.log(`\nTOTAL: ${diferencias.length} diferencias`);

    return { ok: false, diferencias };
}
