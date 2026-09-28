import { and, desc, eq } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { transaccionesTable } from "./transaccion.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { librosTransaccionesTable } from "./librosTransacciones.schema";
import { librosTable } from "../libro/libro.schema";
import { TipoTransaccion, TransaccionInsert } from "./transaccion.validator";
import { LibroOperacion, TransaccionConCliente } from "./operacion.types";
import { NotFound } from "bradb";

export type TransaccionRepositoryDeps = {
    db: Database;
};

export function createTransaccionRepository({ db }: TransaccionRepositoryDeps) {
    const insert = async (body: TransaccionInsert, tx: Tx) => {
        const [row] = await tx.insert(transaccionesTable).values(body).returning();
        return row;
    };

    const saveLibros = async (libros: LibroOperacion[], idTransaccion: number, tx: Tx): Promise<void> => {
        await tx.insert(librosTransaccionesTable).values(
            libros.map((libro) => ({
                id_transaccion: idTransaccion,
                id_libro: libro.id_libro,
                cantidad: libro.cantidad,
                precio: libro.precio
            }))
        );
    };

    const selectTransaccionConCliente = () =>
        db
            .select({
                id: transaccionesTable.id,
                fecha: transaccionesTable.fecha,
                id_cliente: transaccionesTable.id_cliente,
                file_path: transaccionesTable.file_path,
                type: transaccionesTable.type,
                user: transaccionesTable.user,
                nombre_cliente: clientesTable.nombre,
                cuit: clientesTable.cuit,
                email: clientesTable.email,
                cond_fiscal: clientesTable.cond_fiscal,
                tipo_cliente: clientesTable.tipo
            })
            .from(transaccionesTable)
            .innerJoin(clientesTable, eq(clientesTable.id, transaccionesTable.id_cliente));

    const getAll = async (tipo: TipoTransaccion, userId: number): Promise<TransaccionConCliente[]> => {
        return selectTransaccionConCliente()
            .where(and(eq(transaccionesTable.type, tipo), eq(transaccionesTable.user, userId)))
            .orderBy(desc(transaccionesTable.id));
    };

    const getById = async (id: number, userId: number): Promise<TransaccionConCliente> => {
        const rows = await selectTransaccionConCliente().where(
            and(eq(transaccionesTable.id, id), eq(transaccionesTable.user, userId))
        );

        if (rows.length === 0) throw new NotFound(`No se encontró la transacción con id ${id}`);
        return rows[0];
    };

    const getLibros = async (idTransaccion: number): Promise<LibroOperacion[]> => {
        const rows = await db
            .select({
                id_libro: librosTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                cantidad: librosTransaccionesTable.cantidad,
                precio: librosTransaccionesTable.precio,
                stock: librosTable.stock
            })
            .from(librosTransaccionesTable)
            .innerJoin(librosTable, eq(librosTable.id_libro, librosTransaccionesTable.id_libro))
            .where(eq(librosTransaccionesTable.id_transaccion, idTransaccion));

        // `librosTable.stock` es nullable a nivel de columna (default 0); acá
        // siempre viene de un libro ya vendido/consignado, así que null se lee
        // como 0 (mismo criterio que el resto del feature para stock ausente).
        return rows.map((row) => ({ ...row, stock: row.stock ?? 0 }));
    };

    return {
        insert,
        saveLibros,
        getAll,
        getById,
        getLibros
    };
}

export type TransaccionRepository = ReturnType<typeof createTransaccionRepository>;
