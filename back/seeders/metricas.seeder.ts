import { asc, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { mediosPagoTable } from "../src/db/schema";
import { PublicLibro } from "../src/modules/libro";
import { Client, ClienteStockService } from "../src/modules/cliente";
import { DepositoRepository } from "../src/modules/deposito";
import { MovimientoRepository } from "../src/modules/movimiento";
import { VentaRepository } from "../src/modules/transaccion";
import { diaDeFecha, mesAnterior, mesDeFecha, ultimoDiaDelMes } from "../src/modules/metricas/metricas.periodo";
import { SeedUser } from "./users.seeder";

// Datos de muestra del panel de métricas (ver specs/014-metricas-ventas):
// reparte ventas en firme y sobre consignación, y ingresos de stock, en los
// últimos meses, para que el panel tenga series, cortes, comparaciones y estado
// vacío. Corre al final del seed (después de operaciones/anticipos/
// liquidaciones) para no alterar nada de lo anterior: las ventas del mes en
// curso que usan Liquidaciones, sus liquidaciones y los anticipos quedan como
// estaban.
const MESES = 13;
// Un mes del pasado se deja a propósito sin ventas (sólo con un ingreso, para
// que el selector lo siga ofreciendo): así el panel tiene un estado sin cortes.
const MESES_SIN_VENTAS_ATRAS = 4;
const VENTAS_MAX_POR_MES = 4;
const INGRESOS_MAX_POR_MES = 3;
const DESCUENTO_MAX = 15;
const CANTIDAD_INGRESO_MINIMA = 20;
const CANTIDAD_INGRESO_MAXIMA = 120;
// Uno de cada cuatro movimientos comerciales sale de stock consignado.
const PROBABILIDAD_CONSIGNADA = 0.25;

// Libros con anticipo (ver anticipos.seeder): no se les agrega ningún ingreso,
// para no cambiar sus reimpresiones derivadas ni su fecha de lanzamiento.
const INDICES_CON_ANTICIPO = new Set([1, 2, 4, 10]);

type LineaMetrica = {
    id_libro: number;
    isbn: string;
    precio: number;
    cantidad: number;
};

type ContextoUsuario = {
    user: SeedUser;
    depositoPrincipalId: number;
    medios: { id: number }[];
    clientes: Client[];
    librosDelUsuario: PublicLibro[];
    librosSinAnticipo: PublicLibro[];
    aleatorio: () => number;
    depositoRepository: ContextoDeps["depositoRepository"];
    clienteStockService: ClienteStockService;
    movimientoRepository: MovimientoRepository;
    ventaRepository: VentaRepository;
};

export type ContextoDeps = {
    depositoRepository: Pick<DepositoRepository, "findPrincipal" | "findClienteDeposito" | "moveStock">;
    clienteStockService: ClienteStockService;
    movimientoRepository: MovimientoRepository;
    ventaRepository: VentaRepository;
};

const round2 = (n: number): number => parseFloat(n.toFixed(2));
const dosDigitos = (n: number): string => String(n).padStart(2, "0");

// Fecha a mediodía de Argentina: el panel decide el mes en hora local, así que
// un movimiento cargado a las 12 queda inequívocamente dentro de su mes.
const fechaEnMes = (mes: string, diaDelMes: number): Date => new Date(`${mes}-${dosDigitos(diaDelMes)}T12:00:00-03:00`);

// Congruencial lineal con semilla fija: el seed no usa `Math.random`, así que
// dos corridas del mismo día dan exactamente los mismos números.
const crearAleatorio = (semilla: number) => {
    let estado = semilla;

    return (): number => {
        estado = (estado * 1664525 + 1013904223) % 4294967296;
        return estado / 4294967296;
    };
};

// Los `cantidad` meses que terminan en `mesEnCurso`, del más viejo al más nuevo.
const mesesHasta = (mesEnCurso: string, cantidad: number): string[] => {
    const meses = [mesEnCurso];
    for (let i = 1; i < cantidad; i++) meses.push(mesAnterior(meses[i - 1]));

    return meses.reverse();
};

const elegir = <T>(aleatorio: () => number, items: T[]): T => items[Math.floor(aleatorio() * items.length)];

const elegirLibros = (contexto: ContextoUsuario, cantidad: number): PublicLibro[] => {
    const inicio = Math.floor(contexto.aleatorio() * contexto.librosDelUsuario.length);
    const total = Math.min(cantidad, contexto.librosDelUsuario.length);

    return Array.from({ length: total }, (_, k) => contexto.librosDelUsuario[(inicio + k) % contexto.librosDelUsuario.length]);
};

const insertarLineas = (contexto: ContextoUsuario, movimientoId: number, lineas: LineaMetrica[], tx: Parameters<MovimientoRepository["insert"]>[1]) =>
    contexto.movimientoRepository.insertLibros(
        movimientoId,
        contexto.user.id,
        lineas.map((linea) => ({ id_libro: linea.id_libro, cantidad: linea.cantidad, precio: linea.precio })),
        tx
    );

const crearVentaFirme = async (contexto: ContextoUsuario, cliente: Client, idMedioPago: number, lineas: LineaMetrica[], descuento: number, total: number, fecha: Date): Promise<void> => {
    await db.transaction(async (tx) => {
        const movimiento = await contexto.movimientoRepository.insert(
            {
                fecha,
                tipo: "venta",
                origen_tipo: "deposito",
                origen_deposito_id: contexto.depositoPrincipalId,
                destino_tipo: "exterior",
                user: contexto.user.id
            },
            tx
        );

        await insertarLineas(contexto, movimiento.id, lineas, tx);
        await contexto.ventaRepository.insert(
            movimiento.id,
            { id_cliente: cliente.id, descuento, id_medio_pago: idMedioPago, comision: 0, tipo_cbte: 11, total },
            tx
        );

        for (const linea of lineas) {
            await contexto.depositoRepository.moveStock(contexto.depositoPrincipalId, linea.id_libro, contexto.user.id, -linea.cantidad, tx);
        }
    });
};

const crearVentaConsignada = async (contexto: ContextoUsuario, cliente: Client, idMedioPago: number, lineas: LineaMetrica[], descuento: number, total: number, fecha: Date): Promise<void> => {
    const depositoCliente = await contexto.depositoRepository.findClienteDeposito(cliente.id, contexto.user.id);

    await db.transaction(async (tx) => {
        // La consignación previa mueve el stock al depósito del cliente y
        // congela el precio; recién después sale la venta sobre consignado.
        const consignacion = await contexto.movimientoRepository.insert(
            {
                fecha,
                tipo: "consignacion",
                origen_tipo: "deposito",
                origen_deposito_id: contexto.depositoPrincipalId,
                destino_tipo: "deposito",
                destino_deposito_id: depositoCliente.id,
                user: contexto.user.id
            },
            tx
        );

        await insertarLineas(contexto, consignacion.id, lineas, tx);

        for (const linea of lineas) {
            await contexto.depositoRepository.moveStock(contexto.depositoPrincipalId, linea.id_libro, contexto.user.id, -linea.cantidad, tx);
            await contexto.depositoRepository.moveStock(depositoCliente.id, linea.id_libro, contexto.user.id, linea.cantidad, tx);
            await contexto.clienteStockService.setPrecio(cliente.id, { id_libro: linea.id_libro, isbn: linea.isbn, precio: linea.precio }, tx);
        }

        const movimiento = await contexto.movimientoRepository.insert(
            {
                fecha,
                tipo: "ventaConsignacion",
                origen_tipo: "deposito",
                origen_deposito_id: depositoCliente.id,
                destino_tipo: "exterior",
                user: contexto.user.id
            },
            tx
        );

        await insertarLineas(contexto, movimiento.id, lineas, tx);
        await contexto.ventaRepository.insert(
            movimiento.id,
            { id_cliente: cliente.id, descuento, id_medio_pago: idMedioPago, comision: 0, tipo_cbte: 11, total },
            tx
        );

        for (const linea of lineas) {
            await contexto.depositoRepository.moveStock(depositoCliente.id, linea.id_libro, contexto.user.id, -linea.cantidad, tx);
        }
    });
};

const crearVenta = async (contexto: ContextoUsuario, fecha: Date): Promise<void> => {
    const consignada = contexto.aleatorio() < PROBABILIDAD_CONSIGNADA;
    const cliente = elegir(contexto.aleatorio, contexto.clientes);
    const medio = elegir(contexto.aleatorio, contexto.medios);
    const lineas: LineaMetrica[] = elegirLibros(contexto, 1 + Math.floor(contexto.aleatorio() * 3)).map((libro) => ({
        id_libro: libro.id_libro,
        isbn: libro.isbn,
        precio: libro.precio,
        cantidad: 1 + Math.floor(contexto.aleatorio() * (consignada ? 3 : 6))
    }));

    const descuento = Math.floor(contexto.aleatorio() * (DESCUENTO_MAX + 1));
    const subtotal = lineas.reduce((acc, linea) => acc + linea.cantidad * linea.precio, 0);
    const total = round2(subtotal * (1 - descuento / 100));

    if (consignada) {
        await crearVentaConsignada(contexto, cliente, medio.id, lineas, descuento, total, fecha);
    } else {
        await crearVentaFirme(contexto, cliente, medio.id, lineas, descuento, total, fecha);
    }
};

const crearIngreso = async (contexto: ContextoUsuario, fecha: Date): Promise<void> => {
    const libro = elegir(contexto.aleatorio, contexto.librosSinAnticipo);
    const cantidad = CANTIDAD_INGRESO_MINIMA + Math.floor(contexto.aleatorio() * (CANTIDAD_INGRESO_MAXIMA - CANTIDAD_INGRESO_MINIMA + 1));

    await db.transaction(async (tx) => {
        const movimiento = await contexto.movimientoRepository.insert(
            {
                fecha,
                tipo: "ingreso",
                origen_tipo: "exterior",
                destino_tipo: "deposito",
                destino_deposito_id: contexto.depositoPrincipalId,
                user: contexto.user.id
            },
            tx
        );

        await contexto.movimientoRepository.insertLibros(movimiento.id, contexto.user.id, [{ id_libro: libro.id_libro, cantidad, precio: null }], tx);
        await contexto.depositoRepository.moveStock(contexto.depositoPrincipalId, libro.id_libro, contexto.user.id, cantidad, tx);
    });
};

const sembrarMes = async (contexto: ContextoUsuario, mes: string, mesesAtras: number, diaDeHoy: number): Promise<void> => {
    const esMesEnCurso = mesesAtras === 0;
    const ultimoDia = ultimoDiaDelMes(mes);
    // El mes en curso se corta en el día de hoy: datos parciales, como los ve
    // el panel.
    const topeDia = esMesEnCurso ? Math.max(1, Math.min(diaDeHoy, ultimoDia)) : ultimoDia;
    const sinVentas = mesesAtras === MESES_SIN_VENTAS_ATRAS;

    if (!sinVentas) {
        const cantidadVentas = 1 + Math.floor(contexto.aleatorio() * VENTAS_MAX_POR_MES);
        for (let i = 0; i < cantidadVentas; i++) {
            // La primera venta del mes cae el día 1: la comparación del mes en
            // curso (tramo 1..hoy) siempre encuentra el anterior.
            const diaVenta = i === 0 ? 1 : 1 + Math.floor(contexto.aleatorio() * topeDia);
            await crearVenta(contexto, fechaEnMes(mes, Math.min(diaVenta, topeDia)));
        }
    }

    const cantidadIngresos = 1 + Math.floor(contexto.aleatorio() * INGRESOS_MAX_POR_MES);
    for (let i = 0; i < cantidadIngresos; i++) {
        await crearIngreso(contexto, fechaEnMes(mes, 1 + Math.floor(contexto.aleatorio() * topeDia)));
    }
};

const sembrarUsuario = async (contexto: ContextoUsuario): Promise<void> => {
    const meses = mesesHasta(mesDeFecha(new Date()), MESES);
    const diaDeHoy = diaDeFecha(new Date());

    for (const [indice, mes] of meses.entries()) {
        await sembrarMes(contexto, mes, meses.length - 1 - indice, diaDeHoy);
    }
};

export async function seedMetricas(users: SeedUser[], libros: PublicLibro[], clientes: Client[], deps: ContextoDeps): Promise<void> {
    for (const [indiceUsuario, user] of users.entries()) {
        const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
        const librosSinAnticipo = librosDelUsuario.filter((_, indice) => !INDICES_CON_ANTICIPO.has(indice));
        const clientesDelUsuario = clientes.filter((cliente) => cliente.user === user.id && cliente.tipo === "inscripto");
        if (librosDelUsuario.length === 0 || librosSinAnticipo.length === 0 || clientesDelUsuario.length === 0) continue;

        const principal = await deps.depositoRepository.findPrincipal(user.id);
        const medios = await db
            .select({ id: mediosPagoTable.id })
            .from(mediosPagoTable)
            .where(eq(mediosPagoTable.user, user.id))
            .orderBy(asc(mediosPagoTable.id));
        if (medios.length === 0) continue;

        await sembrarUsuario({
            user,
            depositoPrincipalId: principal.id,
            medios,
            clientes: clientesDelUsuario,
            librosDelUsuario,
            librosSinAnticipo,
            aleatorio: crearAleatorio(20261016 + indiceUsuario * 7919),
            ...deps
        });
    }
}
