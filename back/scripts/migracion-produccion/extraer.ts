import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { MigracionConfig } from "./config";
import {
    ClienteOrigen,
    DatosMigracion,
    LibroClienteOrigen,
    LibroOrigen,
    LibroPersonaOrigen,
    LineaOrigen,
    PersonaOrigen,
    PrecioLibroClienteOrigen,
    PrecioLibroOrigen,
    TransaccionOrigen,
    UsuarioOrigen,
    VentaOrigen
} from "./tipos";

type Fila = Record<string, unknown>;

const texto = (value: unknown): string => (value === null || value === undefined ? "" : String(value));

const textoOpcional = (value: unknown): string | null =>
    value === null || value === undefined || value === "" ? null : String(value);

const numero = (value: unknown): number => Number(value ?? 0);

const numeroOpcional = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value);

const booleano = (value: unknown): boolean => Number(value ?? 0) === 1;

const marcas = (ids: readonly number[]): string => ids.map(() => "?").join(", ");

function normalizarPassword(value: unknown): string {
    const raw = Buffer.isBuffer(value) ? value.toString("utf8") : texto(value);
    // `binary(60)` rellena con \0 cuando el hash es más corto; Postgres no los
    // acepta en un varchar normal.
    let fin = raw.length;
    while (fin > 0 && raw.charCodeAt(fin - 1) === 0) fin -= 1;
    return raw.slice(0, fin);
}

async function consultar(conexion: Connection, sql: string, params: unknown[] = []): Promise<Fila[]> {
    const [filas] = await conexion.query<RowDataPacket[]>(sql, params);
    return filas as unknown as Fila[];
}

async function extraerUsuarios(conexion: Connection, cuentas: readonly number[]): Promise<UsuarioOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id, username, password, cuit, cond_fiscal, razon_social, domicilio,
                production, email, ingresos_brutos, fecha_inicio, punto_venta
         FROM users WHERE id IN (${marcas(cuentas)}) ORDER BY id`,
        [...cuentas]
    );

    return filas.map((fila) => ({
        id: numero(fila.id),
        username: texto(fila.username),
        password: normalizarPassword(fila.password),
        cuit: texto(fila.cuit),
        cond_fiscal: texto(fila.cond_fiscal),
        razon_social: texto(fila.razon_social),
        domicilio: texto(fila.domicilio),
        production: booleano(fila.production),
        email: texto(fila.email),
        ingresos_brutos: booleano(fila.ingresos_brutos),
        fecha_inicio: texto(fila.fecha_inicio),
        punto_venta: numeroOpcional(fila.punto_venta)
    }));
}

async function extraerClientes(conexion: Connection, cuentas: readonly number[]): Promise<ClienteOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id, nombre, email, cuit, cond_fiscal, razon_social, domicilio, tipo, user
         FROM clientes WHERE user IN (${marcas(cuentas)}) ORDER BY id`,
        [...cuentas]
    );

    return filas.map((fila) => ({
        id: numero(fila.id),
        nombre: texto(fila.nombre),
        email: texto(fila.email),
        cuit: textoOpcional(fila.cuit),
        cond_fiscal: texto(fila.cond_fiscal),
        razon_social: texto(fila.razon_social),
        domicilio: texto(fila.domicilio),
        tipo: (textoOpcional(fila.tipo) as ClienteOrigen["tipo"]) ?? null,
        user: numero(fila.user)
    }));
}

async function extraerPersonas(conexion: Connection, cuentas: readonly number[]): Promise<PersonaOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id, dni, nombre, email, is_deleted, user
         FROM personas WHERE user IN (${marcas(cuentas)}) ORDER BY id`,
        [...cuentas]
    );

    return filas.map((fila) => ({
        id: numero(fila.id),
        dni: texto(fila.dni),
        nombre: texto(fila.nombre),
        email: texto(fila.email),
        is_deleted: booleano(fila.is_deleted),
        user: numero(fila.user)
    }));
}

async function extraerLibros(conexion: Connection, cuentas: readonly number[]): Promise<LibroOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id_libro, isbn, titulo, fecha_edicion, precio, stock, is_deleted, user
         FROM libros WHERE user IN (${marcas(cuentas)}) ORDER BY id_libro`,
        [...cuentas]
    );

    return filas.map((fila) => ({
        id_libro: numero(fila.id_libro),
        isbn: texto(fila.isbn),
        titulo: texto(fila.titulo),
        fecha_edicion: texto(fila.fecha_edicion),
        precio: numero(fila.precio),
        stock: numero(fila.stock),
        is_deleted: booleano(fila.is_deleted),
        user: numero(fila.user)
    }));
}

async function extraerPreciosLibros(conexion: Connection, cuentas: readonly number[]): Promise<PrecioLibroOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id, isbn, precio, created_at, user, id_libro
         FROM precio_libros WHERE user IN (${marcas(cuentas)}) ORDER BY id`,
        [...cuentas]
    );

    return filas.map((fila) => ({
        id: numero(fila.id),
        isbn: texto(fila.isbn),
        precio: numero(fila.precio),
        created_at: texto(fila.created_at),
        user: numero(fila.user),
        id_libro: numero(fila.id_libro)
    }));
}

async function extraerPreciosLibroCliente(
    conexion: Connection,
    libros: readonly number[],
    clientes: readonly number[]
): Promise<PrecioLibroClienteOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id, id_libro, id_cliente, precio, created_at
         FROM precio_libro_cliente
         WHERE id_libro IN (${marcas(libros)}) AND id_cliente IN (${marcas(clientes)})
         ORDER BY id`,
        [...libros, ...clientes]
    );

    return filas.map((fila) => ({
        id: numero(fila.id),
        id_libro: numero(fila.id_libro),
        id_cliente: numero(fila.id_cliente),
        precio: numero(fila.precio),
        created_at: texto(fila.created_at)
    }));
}

async function extraerLibrosCliente(
    conexion: Connection,
    libros: readonly number[],
    clientes: readonly number[]
): Promise<LibroClienteOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id_cliente, isbn, stock, id_libro, precio
         FROM libro_cliente
         WHERE id_libro IN (${marcas(libros)}) AND id_cliente IN (${marcas(clientes)})
         ORDER BY id_libro, id_cliente`,
        [...libros, ...clientes]
    );

    return filas.map((fila) => ({
        id_cliente: numero(fila.id_cliente),
        isbn: texto(fila.isbn),
        stock: numero(fila.stock),
        id_libro: numero(fila.id_libro),
        precio: numero(fila.precio)
    }));
}

async function extraerLibrosPersonas(
    conexion: Connection,
    libros: readonly number[],
    personas: readonly number[]
): Promise<LibroPersonaOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT isbn, id_persona, porcentaje, tipo, id_libro
         FROM libros_personas
         WHERE id_libro IN (${marcas(libros)}) AND id_persona IN (${marcas(personas)})
         ORDER BY id_libro, id_persona, tipo`,
        [...libros, ...personas]
    );

    return filas.map((fila) => ({
        isbn: texto(fila.isbn),
        id_persona: numero(fila.id_persona),
        porcentaje: numero(fila.porcentaje),
        tipo: texto(fila.tipo) as LibroPersonaOrigen["tipo"],
        id_libro: numero(fila.id_libro)
    }));
}

async function extraerTransacciones(
    conexion: Connection,
    cuentas: readonly number[]
): Promise<TransaccionOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT id, fecha, id_cliente, file_path, type, user
         FROM transacciones WHERE user IN (${marcas(cuentas)}) ORDER BY id`,
        [...cuentas]
    );

    return filas.map((fila) => ({
        id: numero(fila.id),
        fecha: texto(fila.fecha),
        id_cliente: numero(fila.id_cliente),
        file_path: textoOpcional(fila.file_path),
        type: texto(fila.type) as TransaccionOrigen["type"],
        user: numero(fila.user)
    }));
}

async function extraerLineas(
    conexion: Connection,
    cuentas: readonly number[],
    libros: readonly number[]
): Promise<LineaOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT lt.id_transaccion, lt.id_libro, lt.cantidad, lt.precio
         FROM libros_transacciones lt
         JOIN transacciones t ON t.id = lt.id_transaccion
         WHERE t.user IN (${marcas(cuentas)}) AND lt.id_libro IN (${marcas(libros)})
         ORDER BY lt.id_transaccion, lt.id_libro`,
        [...cuentas, ...libros]
    );

    return filas.map((fila) => ({
        id_transaccion: numero(fila.id_transaccion),
        id_libro: numero(fila.id_libro),
        cantidad: numero(fila.cantidad),
        precio: numero(fila.precio)
    }));
}

async function extraerVentas(conexion: Connection, cuentas: readonly number[]): Promise<VentaOrigen[]> {
    const filas = await consultar(
        conexion,
        `SELECT v.id_transaccion, v.descuento, v.total, v.tipo_cbte, v.medio_pago
         FROM ventas v
         JOIN transacciones t ON t.id = v.id_transaccion
         WHERE t.user IN (${marcas(cuentas)})
         ORDER BY v.id_transaccion`,
        [...cuentas]
    );

    return filas.map((fila) => ({
        id_transaccion: numero(fila.id_transaccion),
        descuento: numero(fila.descuento),
        total: numero(fila.total),
        tipo_cbte: numero(fila.tipo_cbte),
        medio_pago: texto(fila.medio_pago) as VentaOrigen["medio_pago"]
    }));
}

export async function extraerDatos(config: MigracionConfig): Promise<DatosMigracion> {
    const conexion = await mysql.createConnection({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        charset: "utf8mb4",
        dateStrings: true,
        timezone: "Z"
    });

    try {
        await conexion.query("SET SESSION time_zone = '+00:00'");

        const users = await extraerUsuarios(conexion, config.cuentas);
        const clientes = await extraerClientes(conexion, config.cuentas);
        const personas = await extraerPersonas(conexion, config.cuentas);
        const libros = await extraerLibros(conexion, config.cuentas);
        const precio_libros = await extraerPreciosLibros(conexion, config.cuentas);
        const libroIds = libros.map((libro) => libro.id_libro);
        const clienteIds = clientes.map((cliente) => cliente.id);
        const personaIds = personas.map((persona) => persona.id);
        const precio_libro_cliente = await extraerPreciosLibroCliente(conexion, libroIds, clienteIds);
        const libro_cliente = await extraerLibrosCliente(conexion, libroIds, clienteIds);
        const libros_personas = await extraerLibrosPersonas(conexion, libroIds, personaIds);
        const transacciones = await extraerTransacciones(conexion, config.cuentas);
        const libros_transacciones = await extraerLineas(conexion, config.cuentas, libroIds);
        const ventas = await extraerVentas(conexion, config.cuentas);

        return {
            meta: {
                generado_en: new Date().toISOString(),
                cuentas: [...config.cuentas],
                origen: `${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`
            },
            users,
            clientes,
            personas,
            libros,
            precio_libros,
            precio_libro_cliente,
            libro_cliente,
            libros_personas,
            transacciones,
            libros_transacciones,
            ventas
        };
    } finally {
        await conexion.end();
    }
}
