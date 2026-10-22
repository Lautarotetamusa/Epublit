import { Client } from "pg";
import { AnalisisDatos, mapearFilePath } from "./analisis";
import {
    esBaseProtegida,
    FECHA_SOFT_DELETE,
    MEDIOS_PAGO_POR_DEFECTO,
    NOMBRE_DEPOSITO_PRINCIPAL,
    PostgresConfig,
    ROLES_POR_DEFECTO
} from "./config";
import { DatosMigracion, TransaccionOrigen } from "./tipos";

type Extremo = {
    tipo: "deposito" | "exterior";
    depositoId: number | null;
};

type Extremos = {
    origen: Extremo;
    destino: Extremo;
};

type Stock = {
    deposito_id: number;
    id_libro: number;
    user: number;
    cantidad: number;
};

type OpcionesCarga = {
    reset: boolean;
    forzar: boolean;
};

type MapasCarga = {
    rolesPorCuenta: Map<string, number>;
    mediosPorCuenta: Map<string, number>;
    principalPorUsuario: Map<number, number>;
    depositoPorCliente: Map<number, number>;
};

export type ResultadoCarga = {
    filas: {
        users: number;
        clientes: number;
        personas: number;
        libros: number;
        precio_libros: number;
        precio_libro_cliente: number;
        libro_cliente: number;
        libros_personas: number;
        movimientos_comerciales: number;
        movimientos_apertura: number;
        movimientos_libros_comerciales: number;
        ventas: number;
        deposito_libros: number;
    };
};

const TABLAS_DOMINIO = [
    "liquidacion_pagos",
    "liquidacion_ventas",
    "liquidacion_lineas",
    "liquidacion_personas",
    "liquidaciones",
    "anticipos",
    "ventas",
    "movimientos_libros",
    "movimientos",
    "deposito_libros",
    "depositos",
    "libros_personas",
    "precio_libro_cliente",
    "precio_libros",
    "libro_cliente",
    "libros",
    "personas",
    "clientes",
    "medios_pago",
    "roles",
    "colecciones",
    "users"
];

const SECUENCIAS: ReadonlyArray<readonly [string, string]> = [
    ["users", "id"],
    ["clientes", "id"],
    ["personas", "id"],
    ["libros", "id_libro"],
    ["precio_libros", "id"],
    ["precio_libro_cliente", "id"],
    ["roles", "id"],
    ["medios_pago", "id"],
    ["depositos", "id"],
    ["movimientos", "id"],
    ["liquidaciones", "id"],
    ["liquidacion_personas", "id"],
    ["liquidacion_lineas", "id"],
    ["liquidacion_pagos", "id"],
    ["anticipos", "id"],
    ["colecciones", "id"]
];

const fechaSoftDelete = (borrado: boolean): string | null => (borrado ? FECHA_SOFT_DELETE : null);

function validarPrecondiciones(analisis: AnalisisDatos, opciones: OpcionesCarga): void {
    if (analisis.ventasSinFila.length > 0) {
        const ids = analisis.ventasSinFila.map((transaccion) => transaccion.id);
        throw new Error(
            `Hay ${ids.length} ventas sin fila en ventas (transacciones ${ids.slice(0, 20).join(", ")}). ` +
                "No se inventan ventas: revisá el origen."
        );
    }

    const mediosInvalidos = analisis.ventasMigrables.filter(
        (venta) => !MEDIOS_PAGO_POR_DEFECTO.includes(venta.medio_pago)
    );
    if (mediosInvalidos.length > 0) {
        const ids = mediosInvalidos.map((venta) => venta.id_transaccion);
        throw new Error(`Medios de pago desconocidos en ventas: ${ids.slice(0, 20).join(", ")}`);
    }

    const principalesNegativas = analisis.aperturasPrincipal.filter((apertura) => apertura.apertura < 0);
    if (principalesNegativas.length > 0 && !opciones.forzar) {
        const detalle = principalesNegativas
            .map((apertura) => `${apertura.id_libro} (${apertura.apertura})`)
            .slice(0, 20)
            .join(", ");
        throw new Error(
            `Hay ${principalesNegativas.length} aperturas negativas del depósito principal: ${detalle}. ` +
                "Corré con --forzar sólo si aceptás el ajuste."
        );
    }
}

async function reiniciarDestino(client: Client, config: PostgresConfig): Promise<void> {
    if (esBaseProtegida(config.database)) {
        throw new Error(`No se resetea la base protegida "${config.database}"`);
    }

    const tablas = TABLAS_DOMINIO.map((tabla) => `"${tabla}"`).join(", ");
    await client.query(`TRUNCATE TABLE ${tablas} RESTART IDENTITY CASCADE`);
}

async function validarCapacidadFilePath(client: Client, datos: DatosMigracion): Promise<void> {
    const maximoOrigen = datos.transacciones.reduce((maximo, transaccion) => {
        const path = mapearFilePath(transaccion.type, transaccion.file_path);
        return path === null ? maximo : Math.max(maximo, path.length);
    }, 0);

    if (maximoOrigen === 0) return;

    const actual = await client.query<{ character_maximum_length: number }>(
        `SELECT character_maximum_length
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'movimientos' AND column_name = 'file_path'`
    );
    const largoActual = actual.rows[0]?.character_maximum_length ?? 0;
    if (largoActual >= maximoOrigen) return;

    throw new Error(
        `movimientos.file_path mide varchar(${largoActual}) y el origen trae un path de ` +
            `${maximoOrigen} caracteres. Aplicá las migraciones Drizzle pendientes antes de cargar.`
    );
}

async function insertarUsuario(client: Client, datos: DatosMigracion["users"][number]): Promise<void> {
    await client.query(
        `INSERT INTO "users" (
            "id", "username", "password", "cuit", "cond_fiscal", "razon_social", "domicilio",
            "production", "email", "ingresos_brutos", "fecha_inicio", "punto_venta"
         ) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
            datos.id,
            datos.username,
            datos.password,
            datos.cuit,
            datos.cond_fiscal,
            datos.razon_social,
            datos.domicilio,
            datos.production,
            datos.email,
            datos.ingresos_brutos,
            datos.fecha_inicio,
            datos.punto_venta
        ]
    );
}

async function insertarCliente(client: Client, datos: DatosMigracion["clientes"][number]): Promise<void> {
    await client.query(
        `INSERT INTO "clientes" (
            "id", "nombre", "email", "cuit", "cond_fiscal", "razon_social", "domicilio",
            "tipo", "user", "deleted_at"
         ) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
            datos.id,
            datos.nombre,
            datos.email,
            datos.cuit,
            datos.cond_fiscal,
            datos.razon_social,
            datos.domicilio,
            datos.tipo,
            datos.user,
            null
        ]
    );
}

async function insertarPersona(client: Client, datos: DatosMigracion["personas"][number]): Promise<void> {
    await client.query(
        `INSERT INTO "personas" ("id", "dni", "nombre", "email", "user", "deleted_at")
         OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6)`,
        [datos.id, datos.dni, datos.nombre, datos.email, datos.user, fechaSoftDelete(datos.is_deleted)]
    );
}

async function insertarLibro(client: Client, datos: DatosMigracion["libros"][number]): Promise<void> {
    await client.query(
        `INSERT INTO "libros" (
            "id_libro", "isbn", "titulo", "fecha_edicion", "precio", "stock", "deleted_at", "user"
         ) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
            datos.id_libro,
            datos.isbn,
            datos.titulo,
            datos.fecha_edicion,
            datos.precio,
            datos.stock,
            fechaSoftDelete(datos.is_deleted),
            datos.user
        ]
    );
}

async function insertarPrecioLibro(
    client: Client,
    datos: DatosMigracion["precio_libros"][number]
): Promise<void> {
    await client.query(
        `INSERT INTO "precio_libros" ("id", "isbn", "precio", "created_at", "user", "id_libro")
         OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6)`,
        [datos.id, datos.isbn, datos.precio, datos.created_at, datos.user, datos.id_libro]
    );
}

async function insertarPrecioLibroCliente(
    client: Client,
    datos: DatosMigracion["precio_libro_cliente"][number]
): Promise<void> {
    await client.query(
        `INSERT INTO "precio_libro_cliente" ("id", "id_libro", "id_cliente", "precio", "created_at")
         OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5)`,
        [datos.id, datos.id_libro, datos.id_cliente, datos.precio, datos.created_at]
    );
}

async function insertarLibroCliente(
    client: Client,
    datos: DatosMigracion["libro_cliente"][number]
): Promise<void> {
    await client.query(
        `INSERT INTO "libro_cliente" ("id_cliente", "isbn", "id_libro", "precio")
         VALUES ($1,$2,$3,$4)`,
        [datos.id_cliente, datos.isbn, datos.id_libro, datos.precio]
    );
}

async function insertarRol(client: Client, user: number, nombre: string): Promise<number> {
    const result = await client.query<{ id: number }>(
        `INSERT INTO "roles" ("nombre", "user") VALUES ($1,$2) RETURNING "id"`,
        [nombre, user]
    );
    return result.rows[0].id;
}

async function insertarMedioPago(client: Client, user: number, nombre: string): Promise<number> {
    const result = await client.query<{ id: number }>(
        `INSERT INTO "medios_pago" ("nombre", "comision", "user") VALUES ($1, 0, $2) RETURNING "id"`,
        [nombre, user]
    );
    return result.rows[0].id;
}

async function insertarDeposito(
    client: Client,
    deposito: { nombre: string; principal: boolean; id_cliente: number | null; user: number }
): Promise<number> {
    const result = await client.query<{ id: number }>(
        `INSERT INTO "depositos" ("nombre", "principal", "id_cliente", "user")
         VALUES ($1,$2,$3,$4) RETURNING "id"`,
        [deposito.nombre, deposito.principal, deposito.id_cliente, deposito.user]
    );
    return result.rows[0].id;
}

async function insertarLibroPersona(
    client: Client,
    datos: DatosMigracion["libros_personas"][number],
    idRol: number
): Promise<void> {
    await client.query(
        `INSERT INTO "libros_personas" (
            "isbn", "id_persona", "porcentaje", "monto_acordado", "id_rol", "id_libro"
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [datos.isbn, datos.id_persona, datos.porcentaje, null, idRol, datos.id_libro]
    );
}

function resolverExtremos(
    transaccion: TransaccionOrigen,
    principalPorUsuario: Map<number, number>,
    depositoPorCliente: Map<number, number>
): Extremos {
    const principal = principalPorUsuario.get(transaccion.user);
    const cliente = depositoPorCliente.get(transaccion.id_cliente);
    if (principal === undefined) throw new Error(`Sin depósito principal para el usuario ${transaccion.user}`);
    if (cliente === undefined) throw new Error(`Sin depósito para el cliente ${transaccion.id_cliente}`);

    const exterior: Extremo = { tipo: "exterior", depositoId: null };
    const depositoPrincipal: Extremo = { tipo: "deposito", depositoId: principal };
    const depositoCliente: Extremo = { tipo: "deposito", depositoId: cliente };

    switch (transaccion.type) {
        case "venta":
            return { origen: depositoPrincipal, destino: exterior };
        case "consignacion":
            return { origen: depositoPrincipal, destino: depositoCliente };
        case "devolucion":
            return { origen: depositoCliente, destino: depositoPrincipal };
        case "ventaConsignacion":
            return { origen: depositoCliente, destino: exterior };
    }
}

async function insertarMovimiento(
    client: Client,
    movimiento: {
        fecha: string;
        tipo: string;
        extremos: Extremos;
        file_path: string | null;
        es_migracion: boolean;
        user: number;
    }
): Promise<number> {
    const result = await client.query<{ id: number }>(
        `INSERT INTO "movimientos" (
            "fecha", "tipo", "origen_tipo", "origen_deposito_id",
            "destino_tipo", "destino_deposito_id", "file_path", "es_migracion", "user"
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING "id"`,
        [
            movimiento.fecha,
            movimiento.tipo,
            movimiento.extremos.origen.tipo,
            movimiento.extremos.origen.depositoId,
            movimiento.extremos.destino.tipo,
            movimiento.extremos.destino.depositoId,
            movimiento.file_path,
            movimiento.es_migracion,
            movimiento.user
        ]
    );
    return result.rows[0].id;
}

async function insertarLineaMovimiento(
    client: Client,
    movimientoId: number,
    linea: { id_libro: number; cantidad: number; precio: number | null },
    user: number
): Promise<void> {
    await client.query(
        `INSERT INTO "movimientos_libros" ("movimiento_id", "id_libro", "cantidad", "precio", "user")
         VALUES ($1,$2,$3,$4,$5)`,
        [movimientoId, linea.id_libro, linea.cantidad, linea.precio, user]
    );
}

async function insertarVenta(
    client: Client,
    venta: DatosMigracion["ventas"][number],
    idMovimiento: number,
    idCliente: number,
    idMedioPago: number
): Promise<void> {
    await client.query(
        `INSERT INTO "ventas" (
            "descuento", "total", "id_medio_pago", "comision", "tipo_cbte", "id_cliente", "id_movimiento"
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [venta.descuento, venta.total, idMedioPago, 0, venta.tipo_cbte, idCliente, idMovimiento]
    );
}

function moverStock(stock: Map<string, Stock>, depositoId: number | null, idLibro: number, user: number, delta: number): void {
    if (depositoId === null) return;
    const key = `${depositoId}:${idLibro}`;
    const actual = stock.get(key) ?? { deposito_id: depositoId, id_libro: idLibro, user, cantidad: 0 };
    actual.cantidad += delta;
    stock.set(key, actual);
}

function aplicarMovimiento(
    stock: Map<string, Stock>,
    extremos: Extremos,
    linea: { id_libro: number; cantidad: number },
    user: number
): void {
    moverStock(stock, extremos.origen.depositoId, linea.id_libro, user, -linea.cantidad);
    moverStock(stock, extremos.destino.depositoId, linea.id_libro, user, linea.cantidad);
}

async function insertarMovimientosComerciales(
    client: Client,
    analisis: AnalisisDatos,
    principalPorUsuario: Map<number, number>,
    depositoPorCliente: Map<number, number>,
    mediosPorCuenta: Map<string, number>,
    stock: Map<string, Stock>
): Promise<{ movimientos: number; lineas: number; ventas: number }> {
    let movimientos = 0;
    let lineas = 0;
    let ventas = 0;

    for (const transaccion of analisis.transaccionesMigrables) {
        const extremos = resolverExtremos(transaccion, principalPorUsuario, depositoPorCliente);
        const idMovimiento = await insertarMovimiento(client, {
            fecha: transaccion.fecha,
            tipo: transaccion.type,
            extremos,
            file_path: mapearFilePath(transaccion.type, transaccion.file_path),
            es_migracion: false,
            user: transaccion.user
        });
        movimientos += 1;

        for (const linea of transaccion.lineas) {
            await insertarLineaMovimiento(client, idMovimiento, linea, transaccion.user);
            aplicarMovimiento(stock, extremos, linea, transaccion.user);
            lineas += 1;
        }

        const venta = analisis.ventasPorTransaccion.get(transaccion.id);
        if (venta) {
            const idMedioPago = mediosPorCuenta.get(`${transaccion.user}:${venta.medio_pago}`);
            if (idMedioPago === undefined) {
                throw new Error(`Sin medio de pago "${venta.medio_pago}" para el usuario ${transaccion.user}`);
            }
            await insertarVenta(client, venta, idMovimiento, transaccion.id_cliente, idMedioPago);
            ventas += 1;
        }
    }

    return { movimientos, lineas, ventas };
}

async function insertarMovimientoApertura(
    client: Client,
    apertura: {
        id_libro: number;
        user: number;
        apertura: number;
        fecha: string;
        deposito: number;
    },
    stock: Map<string, Stock>
): Promise<void> {
    const cantidad = Math.abs(apertura.apertura);
    const exterior: Extremo = { tipo: "exterior", depositoId: null };
    const deposito: Extremo = { tipo: "deposito", depositoId: apertura.deposito };
    const ingreso = apertura.apertura > 0;
    const extremos: Extremos = ingreso
        ? { origen: exterior, destino: deposito }
        : { origen: deposito, destino: exterior };

    const idMovimiento = await insertarMovimiento(client, {
        fecha: apertura.fecha,
        tipo: ingreso ? "ingreso" : "baja",
        extremos,
        file_path: null,
        es_migracion: true,
        user: apertura.user
    });

    await insertarLineaMovimiento(
        client,
        idMovimiento,
        { id_libro: apertura.id_libro, cantidad, precio: null },
        apertura.user
    );
    aplicarMovimiento(stock, extremos, { id_libro: apertura.id_libro, cantidad }, apertura.user);
}

async function insertarAperturas(
    client: Client,
    analisis: AnalisisDatos,
    principalPorUsuario: Map<number, number>,
    depositoPorCliente: Map<number, number>,
    stock: Map<string, Stock>
): Promise<number> {
    let movimientos = 0;

    for (const apertura of analisis.aperturasPrincipal) {
        const deposito = principalPorUsuario.get(apertura.user);
        if (deposito === undefined) throw new Error(`Sin depósito principal para el usuario ${apertura.user}`);
        await insertarMovimientoApertura(client, { ...apertura, deposito }, stock);
        movimientos += 1;
    }

    for (const apertura of analisis.aperturasCliente) {
        const deposito = depositoPorCliente.get(apertura.id_cliente);
        if (deposito === undefined) throw new Error(`Sin depósito para el cliente ${apertura.id_cliente}`);
        await insertarMovimientoApertura(client, { ...apertura, deposito }, stock);
        movimientos += 1;
    }

    return movimientos;
}

async function insertarDepositoLibros(client: Client, stock: Map<string, Stock>): Promise<number> {
    const negativos = [...stock.values()].filter((fila) => fila.cantidad < 0);
    if (negativos.length > 0) {
        const detalle = negativos
            .map((fila) => `depósito ${fila.deposito_id}/libro ${fila.id_libro}: ${fila.cantidad}`)
            .slice(0, 20)
            .join(", ");
        throw new Error(`Stock negativo en el destino: ${detalle}`);
    }

    const filas = [...stock.values()].filter((fila) => fila.cantidad !== 0);
    for (const fila of filas) {
        await client.query(
            `INSERT INTO "deposito_libros" ("deposito_id", "id_libro", "cantidad", "user")
             VALUES ($1,$2,$3,$4)`,
            [fila.deposito_id, fila.id_libro, fila.cantidad, fila.user]
        );
    }
    return filas.length;
}

async function avanzarSecuencias(client: Client): Promise<void> {
    for (const [tabla, columna] of SECUENCIAS) {
        await client.query(
            `SELECT setval(
                pg_get_serial_sequence($1, $2),
                COALESCE((SELECT max("${columna}") FROM "${tabla}"), 1),
                (SELECT max("${columna}") FROM "${tabla}") IS NOT NULL
             )`,
            [tabla, columna]
        );
    }
}

async function insertarRolesYMedios(
    client: Client,
    datos: DatosMigracion
): Promise<Pick<MapasCarga, "rolesPorCuenta" | "mediosPorCuenta">> {
    const rolesPorCuenta = new Map<string, number>();
    const mediosPorCuenta = new Map<string, number>();

    for (const usuario of datos.users) {
        for (const nombre of ROLES_POR_DEFECTO) {
            rolesPorCuenta.set(`${usuario.id}:${nombre}`, await insertarRol(client, usuario.id, nombre));
        }
        for (const nombre of MEDIOS_PAGO_POR_DEFECTO) {
            mediosPorCuenta.set(
                `${usuario.id}:${nombre}`,
                await insertarMedioPago(client, usuario.id, nombre)
            );
        }
    }

    return { rolesPorCuenta, mediosPorCuenta };
}

async function insertarDepositos(
    client: Client,
    datos: DatosMigracion
): Promise<Pick<MapasCarga, "principalPorUsuario" | "depositoPorCliente">> {
    const principalPorUsuario = new Map<number, number>();
    const depositoPorCliente = new Map<number, number>();

    for (const usuario of datos.users) {
        principalPorUsuario.set(
            usuario.id,
            await insertarDeposito(client, {
                nombre: NOMBRE_DEPOSITO_PRINCIPAL,
                principal: true,
                id_cliente: null,
                user: usuario.id
            })
        );
    }

    for (const cliente of datos.clientes) {
        depositoPorCliente.set(
            cliente.id,
            await insertarDeposito(client, {
                nombre: cliente.nombre,
                principal: false,
                id_cliente: cliente.id,
                user: cliente.user
            })
        );
    }

    return { principalPorUsuario, depositoPorCliente };
}

async function insertarPreciosYRelaciones(
    client: Client,
    datos: DatosMigracion,
    rolesPorCuenta: Map<string, number>
): Promise<void> {
    for (const precio of datos.precio_libros) await insertarPrecioLibro(client, precio);
    for (const precio of datos.precio_libro_cliente) await insertarPrecioLibroCliente(client, precio);
    for (const fila of datos.libro_cliente) await insertarLibroCliente(client, fila);

    const usuarioPorLibro = new Map(datos.libros.map((libro) => [libro.id_libro, libro.user]));
    for (const fila of datos.libros_personas) {
        const user = usuarioPorLibro.get(fila.id_libro);
        if (user === undefined) throw new Error(`Libro ${fila.id_libro} sin usuario para libros_personas`);
        const idRol = rolesPorCuenta.get(`${user}:${fila.tipo}`);
        if (idRol === undefined) throw new Error(`Rol "${fila.tipo}" inexistente para el usuario ${user}`);
        await insertarLibroPersona(client, fila, idRol);
    }
}

async function insertarCatalogos(client: Client, datos: DatosMigracion): Promise<MapasCarga> {
    for (const usuario of datos.users) await insertarUsuario(client, usuario);
    for (const cliente of datos.clientes) await insertarCliente(client, cliente);
    for (const persona of datos.personas) await insertarPersona(client, persona);
    for (const libro of datos.libros) await insertarLibro(client, libro);

    const { rolesPorCuenta, mediosPorCuenta } = await insertarRolesYMedios(client, datos);
    const { principalPorUsuario, depositoPorCliente } = await insertarDepositos(client, datos);
    await insertarPreciosYRelaciones(client, datos, rolesPorCuenta);

    return { rolesPorCuenta, mediosPorCuenta, principalPorUsuario, depositoPorCliente };
}

async function insertarMovimientosYStock(
    client: Client,
    analisis: AnalisisDatos,
    mapas: MapasCarga
): Promise<{
    comerciales: { movimientos: number; lineas: number; ventas: number };
    movimientosApertura: number;
    depositoLibros: number;
}> {
    const stock = new Map<string, Stock>();
    const comerciales = await insertarMovimientosComerciales(
        client,
        analisis,
        mapas.principalPorUsuario,
        mapas.depositoPorCliente,
        mapas.mediosPorCuenta,
        stock
    );
    const movimientosApertura = await insertarAperturas(
        client,
        analisis,
        mapas.principalPorUsuario,
        mapas.depositoPorCliente,
        stock
    );
    const depositoLibros = await insertarDepositoLibros(client, stock);

    return { comerciales, movimientosApertura, depositoLibros };
}

function resultadoCarga(
    datos: DatosMigracion,
    comerciales: { movimientos: number; lineas: number; ventas: number },
    movimientosApertura: number,
    depositoLibros: number
): ResultadoCarga {
    return {
        filas: {
            users: datos.users.length,
            clientes: datos.clientes.length,
            personas: datos.personas.length,
            libros: datos.libros.length,
            precio_libros: datos.precio_libros.length,
            precio_libro_cliente: datos.precio_libro_cliente.length,
            libro_cliente: datos.libro_cliente.length,
            libros_personas: datos.libros_personas.length,
            movimientos_comerciales: comerciales.movimientos,
            movimientos_apertura: movimientosApertura,
            movimientos_libros_comerciales: comerciales.lineas,
            ventas: comerciales.ventas,
            deposito_libros: depositoLibros
        }
    };
}

export async function cargarDatos(
    config: PostgresConfig,
    datos: DatosMigracion,
    analisis: AnalisisDatos,
    opciones: OpcionesCarga
): Promise<ResultadoCarga> {
    validarPrecondiciones(analisis, opciones);
    if (opciones.reset && esBaseProtegida(config.database)) {
        throw new Error(`No se resetea la base protegida "${config.database}"`);
    }

    const client = new Client(config);
    await client.connect();

    try {
        await client.query("BEGIN");
        if (opciones.reset) await reiniciarDestino(client, config);

        await validarCapacidadFilePath(client, datos);
        const mapas = await insertarCatalogos(client, datos);
        const { comerciales, movimientosApertura, depositoLibros } = await insertarMovimientosYStock(
            client,
            analisis,
            mapas
        );

        await avanzarSecuencias(client);
        await client.query("COMMIT");

        return resultadoCarga(datos, comerciales, movimientosApertura, depositoLibros);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
    }
}
