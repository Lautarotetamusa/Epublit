import { and, eq, lte, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../pgDb";
import { libroClienteTable } from "../schemas/libroCliente.schema";
import { precioLibroClienteTable } from "../schemas/precioLibroCliente.schema";
import { librosTable } from "../schemas/libros.schema";
import { clienteService } from "./cliente.service";
import { Tx } from "./operacion.types";

// `libro_cliente`/`precio_libro_cliente` no tienen columna `user` propia: el
// dueño se hereda del cliente ya validado por `clienteService.findOne` (ver
// plan, "Enfoque técnico"). Nunca se recibe `id_libro` como input directo del
// usuario, así que scopear por `id_cliente` alcanza.

// `precio_libro_cliente.created_at` guarda instantes en UTC (Postgres corre
// sin timezone seteado); sumar 3 horas al `fecha` recibido es la forma de
// interpretarlo como un instante GMT-3 (Argentina), ver plan "Decisiones y
// trade-offs".
const GMT3_OFFSET_MS = 3 * 60 * 60 * 1000;

const getStockActual = async (clienteId: number) => {
    return db
        .select({
            titulo: librosTable.titulo,
            id_libro: librosTable.id_libro,
            isbn: librosTable.isbn,
            precio: libroClienteTable.precio,
            stock: libroClienteTable.stock
        })
        .from(libroClienteTable)
        .innerJoin(librosTable, eq(librosTable.id_libro, libroClienteTable.id_libro))
        .where(eq(libroClienteTable.id_cliente, clienteId))
        .orderBy(librosTable.titulo);
};

const getStockAFecha = async (clienteId: number, fecha: Date) => {
    const fechaGMT3 = new Date(fecha.getTime() + GMT3_OFFSET_MS);

    const ultimoPrecioVigente = db
        .select({
            id_libro: precioLibroClienteTable.id_libro,
            last_date: sql<Date>`max(${precioLibroClienteTable.created_at})`.as("last_date")
        })
        .from(precioLibroClienteTable)
        .where(and(eq(precioLibroClienteTable.id_cliente, clienteId), lte(precioLibroClienteTable.created_at, fechaGMT3)))
        .groupBy(precioLibroClienteTable.id_libro)
        .as("ultimo_precio_vigente");

    return db
        .select({
            titulo: librosTable.titulo,
            id_libro: librosTable.id_libro,
            isbn: librosTable.isbn,
            precio: precioLibroClienteTable.precio,
            stock: libroClienteTable.stock
        })
        .from(ultimoPrecioVigente)
        .innerJoin(
            precioLibroClienteTable,
            and(
                eq(precioLibroClienteTable.id_libro, ultimoPrecioVigente.id_libro),
                eq(precioLibroClienteTable.created_at, ultimoPrecioVigente.last_date),
                eq(precioLibroClienteTable.id_cliente, clienteId)
            )
        )
        .innerJoin(
            libroClienteTable,
            and(eq(libroClienteTable.id_libro, precioLibroClienteTable.id_libro), eq(libroClienteTable.id_cliente, clienteId))
        )
        .innerJoin(librosTable, eq(librosTable.id_libro, precioLibroClienteTable.id_libro))
        .orderBy(librosTable.titulo);
};

const getStock = async (clienteId: number, userId: number, fecha?: Date) => {
    const cliente = await clienteService.findOne({ id: clienteId, user: userId });

    return fecha === undefined ? getStockActual(cliente.id) : getStockAFecha(cliente.id, fecha);
};

// A diferencia del `Cliente.updatePrecios` actual, no lanza si ningún precio
// estaba desactualizado (corrige el bug de `NothingChanged`, ver plan): si no
// hay filas para sincronizar, simplemente no hace nada.
const syncPrecios = async (clienteId: number, userId: number) => {
    const cliente = await clienteService.findOne({ id: clienteId, user: userId });

    await db.transaction(async (tx) => {
        const desactualizados = await tx
            .select({ id_libro: libroClienteTable.id_libro, precio: librosTable.precio })
            .from(libroClienteTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, libroClienteTable.id_libro), ne(librosTable.precio, libroClienteTable.precio))
            )
            .where(eq(libroClienteTable.id_cliente, cliente.id));

        if (desactualizados.length === 0) return;

        // Se graba el precio *nuevo* del libro en el historial, con el
        // timestamp de "ahora" (mismo comportamiento que el modelo MySQL
        // actual, ver plan "Decisiones y trade-offs").
        await tx.insert(precioLibroClienteTable).values(
            desactualizados.map((d) => ({
                id_libro: d.id_libro,
                id_cliente: cliente.id,
                precio: d.precio
            }))
        );

        for (const d of desactualizados) {
            await tx
                .update(libroClienteTable)
                .set({ precio: d.precio })
                .where(and(eq(libroClienteTable.id_libro, d.id_libro), eq(libroClienteTable.id_cliente, cliente.id)));
        }
    });

    return getStock(clienteId, userId);
};

// Reemplaza `cliente.addStock`/`cliente.reduceStock` (`stockDeClienteNoMigrado()`
// hoy): un único upsert cubre ambos sentidos del delta (ver plan, "Decisiones
// y trade-offs" — no crear `addStock`/`reduceStock` separadas). `isbn` se
// pide acá (además de `id_libro`/`precio`) porque `libro_cliente.isbn` es
// NOT NULL y hace falta para poder crear la fila la primera vez que un
// cliente recibe ese libro en consignación; todo `resolverLibros` que llega
// a `moverStock` ya tiene el isbn resuelto en su `LibroOperacion`.
const moveStock = async (
    clienteId: number,
    libro: { id_libro: number; isbn: string; precio: number },
    delta: number,
    tx?: Tx
): Promise<void> => {
    await (tx ?? db)
        .insert(libroClienteTable)
        .values({
            id_cliente: clienteId,
            id_libro: libro.id_libro,
            isbn: libro.isbn,
            precio: libro.precio,
            stock: delta
        })
        .onConflictDoUpdate({
            target: [libroClienteTable.id_libro, libroClienteTable.id_cliente],
            set: { stock: sql`${libroClienteTable.stock} + ${delta}` }
        });
};

export const clienteStockService = {
    getStock,
    syncPrecios,
    moveStock
};
