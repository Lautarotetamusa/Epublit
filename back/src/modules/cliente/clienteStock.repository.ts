import { and, eq, gt, ne, sql } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { libroClienteTable } from "./libroCliente.schema";
import { precioLibroClienteTable } from "./precioLibroCliente.schema";
import { depositoLibrosTable } from "../deposito/depositoLibros.schema";
import { librosTable } from "../libro/libro.schema";

// Las cantidades consignadas viven en el depósito propio del cliente
// (`deposito_libros`), no en `libro_cliente`: esa tabla sólo guarda el precio
// congelado (ver specs/009-ledger-unificado). `libro_cliente`/
// `precio_libro_cliente` no tienen columna `user` propia: el dueño se hereda
// del cliente ya validado por el service. Nunca se recibe `id_libro` como
// input directo del usuario, así que scopear por `id_cliente`/`deposito_id`
// alcanza.
const GMT3_OFFSET_MS = 3 * 60 * 60 * 1000;

export type ClienteStockRepositoryDeps = {
    db: Database;
};

export function createClienteStockRepository({ db }: ClienteStockRepositoryDeps) {
    // Fragmento compartido por `getStockActual`/`getStockAFecha`: los libros con
    // cantidad mayor a 0 en el depósito del cliente, con título/isbn del
    // catálogo y el precio congelado del cliente.
    const stockDelDeposito = (depositoId: number, clienteId: number) =>
        db
            .select({
                titulo: librosTable.titulo,
                id_libro: librosTable.id_libro,
                isbn: librosTable.isbn,
                precio: sql<number>`coalesce(${libroClienteTable.precio}, 0)`.mapWith(Number),
                stock: depositoLibrosTable.cantidad
            })
            .from(depositoLibrosTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, depositoLibrosTable.id_libro), eq(librosTable.user, depositoLibrosTable.user))
            )
            .leftJoin(
                libroClienteTable,
                and(
                    eq(libroClienteTable.id_libro, depositoLibrosTable.id_libro),
                    eq(libroClienteTable.id_cliente, clienteId)
                )
            )
            .where(and(eq(depositoLibrosTable.deposito_id, depositoId), gt(depositoLibrosTable.cantidad, 0)))
            .orderBy(librosTable.titulo);

    return {
        getStockActual: stockDelDeposito,

        // `precio_libro_cliente.created_at` guarda instantes en UTC (Postgres
        // corre sin timezone seteado); sumar 3 horas al `fecha` recibido es la
        // forma de interpretarlo como un instante GMT-3 (Argentina). El valor
        // se compara como timestamp UTC explícito (no como `Date`): el driver
        // serializa un `Date` en la hora local del proceso y correría la
        // comparación. Si no hay precio histórico para ese libro en esa fecha,
        // cae al congelado vigente (y a 0 si tampoco hay).
        getStockAFecha: async (depositoId: number, clienteId: number, fecha: Date) => {
            const fechaGMT3 = new Date(fecha.getTime() + GMT3_OFFSET_MS);
            const fechaUTC = fechaGMT3.toISOString().replace("T", " ").replace("Z", "");

            return db
                .select({
                    titulo: librosTable.titulo,
                    id_libro: librosTable.id_libro,
                    isbn: librosTable.isbn,
                    precio: sql<number>`coalesce((
                        select ${precioLibroClienteTable.precio}
                        from ${precioLibroClienteTable}
                        where ${precioLibroClienteTable.id_cliente} = ${clienteId}
                            and ${precioLibroClienteTable.id_libro} = ${depositoLibrosTable.id_libro}
                            and ${precioLibroClienteTable.created_at} <= ${fechaUTC}::timestamp
                        order by ${precioLibroClienteTable.created_at} desc
                        limit 1
                    ), ${libroClienteTable.precio}, 0)`.mapWith(Number),
                    stock: depositoLibrosTable.cantidad
                })
                .from(depositoLibrosTable)
                .innerJoin(
                    librosTable,
                    and(eq(librosTable.id_libro, depositoLibrosTable.id_libro), eq(librosTable.user, depositoLibrosTable.user))
                )
                .leftJoin(
                    libroClienteTable,
                    and(
                        eq(libroClienteTable.id_libro, depositoLibrosTable.id_libro),
                        eq(libroClienteTable.id_cliente, clienteId)
                    )
                )
                .where(and(eq(depositoLibrosTable.deposito_id, depositoId), gt(depositoLibrosTable.cantidad, 0)))
                .orderBy(librosTable.titulo);
        },

        findPreciosDesactualizados: async (clienteId: number, tx?: Tx) => {
            return (tx ?? db)
                .select({ id_libro: libroClienteTable.id_libro, precio: librosTable.precio })
                .from(libroClienteTable)
                .innerJoin(
                    librosTable,
                    and(eq(librosTable.id_libro, libroClienteTable.id_libro), ne(librosTable.precio, libroClienteTable.precio))
                )
                .where(eq(libroClienteTable.id_cliente, clienteId));
        },

        insertPrecioHistorial: async (rows: { id_libro: number; id_cliente: number; precio: number }[], tx?: Tx) => {
            await (tx ?? db).insert(precioLibroClienteTable).values(rows);
        },

        updatePrecio: async (idLibro: number, clienteId: number, precio: number, tx?: Tx) => {
            await (tx ?? db)
                .update(libroClienteTable)
                .set({ precio })
                .where(and(eq(libroClienteTable.id_libro, idLibro), eq(libroClienteTable.id_cliente, clienteId)));
        },

        // Congela el precio de un libro para el cliente (upsert por
        // (id_libro, id_cliente)): lo usa la consignación. La cantidad NO se
        // toca acá; se mueve por el depósito del cliente.
        setPrecio: async (
            clienteId: number,
            libro: { id_libro: number; isbn: string; precio: number },
            tx?: Tx
        ): Promise<void> => {
            await (tx ?? db)
                .insert(libroClienteTable)
                .values({
                    id_cliente: clienteId,
                    id_libro: libro.id_libro,
                    isbn: libro.isbn,
                    precio: libro.precio
                })
                .onConflictDoUpdate({
                    target: [libroClienteTable.id_libro, libroClienteTable.id_cliente],
                    set: { precio: libro.precio }
                });
        }
    };
}

export type ClienteStockRepository = ReturnType<typeof createClienteStockRepository>;
