import { and, desc, eq } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { ventasTable } from "./venta.schema";
import { transaccionesTable } from "./transaccion.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { VentaInsert } from "./venta.validator";
import { LibroOperacion } from "./operacion.types";
import { NotFound } from "bradb";

export type VentaRepositoryDeps = {
    db: Database;
};

export function createVentaRepository({ db }: VentaRepositoryDeps) {
    const insert = async (idTransaccion: number, body: Omit<VentaInsert, "id_transaccion">, tx: Tx) => {
        const [row] = await tx
            .insert(ventasTable)
            .values({ ...body, id_transaccion: idTransaccion })
            .returning();
        return row;
    };

    // Copia exacta de `Venta.calcTotal` (MySQL): función pura, sin cambios de lógica.
    const calcTotal = (libros: LibroOperacion[], descuento: number): number => {
        let total = libros.reduce((acumulador, libro) => acumulador + libro.cantidad * libro.precio, 0);

        total -= total * descuento * 0.01;
        total = parseFloat(total.toFixed(2));
        return total;
    };

    const selectVentaConTransaccion = () =>
        db
            .select({
                id_transaccion: ventasTable.id_transaccion,
                descuento: ventasTable.descuento,
                total: ventasTable.total,
                medio_pago: ventasTable.medio_pago,
                tipo_cbte: ventasTable.tipo_cbte,
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
            .from(ventasTable)
            .innerJoin(transaccionesTable, eq(transaccionesTable.id, ventasTable.id_transaccion))
            .innerJoin(clientesTable, eq(clientesTable.id, transaccionesTable.id_cliente));

    const getAll = async (tipo: "venta" | "ventaConsignacion", userId: number) => {
        return selectVentaConTransaccion()
            .where(and(eq(transaccionesTable.type, tipo), eq(transaccionesTable.user, userId)))
            .orderBy(desc(ventasTable.id_transaccion));
    };

    const getById = async (id: number, userId: number) => {
        const rows = await selectVentaConTransaccion().where(
            and(eq(transaccionesTable.id, id), eq(transaccionesTable.user, userId))
        );

        if (rows.length === 0) throw new NotFound(`No se encontró la venta con id ${id}`);
        return rows[0];
    };

    return {
        insert,
        calcTotal,
        getAll,
        getById
    };
}

export type VentaRepository = ReturnType<typeof createVentaRepository>;
