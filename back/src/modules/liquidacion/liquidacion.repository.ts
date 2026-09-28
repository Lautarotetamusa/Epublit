import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { Database } from "../../db/client";
import { transaccionesTable } from "../transaccion/transaccion.schema";
import { librosTransaccionesTable } from "../transaccion/librosTransacciones.schema";
import { librosTable } from "../libro/libro.schema";
import { librosPersonasTable } from "../libro/libroPersona.schema";
import { personasTable } from "../persona/persona.schema";

export type LiquidacionRepositoryDeps = {
    db: Database;
};

// Tipos de transacción que cuentan como venta para la liquidación (plan,
// tarea 2): `devolucion`/`consignacion` quedan afuera a propósito.
const TIPOS_VENTA = ["venta", "ventaConsignacion"] as const;

export function createLiquidacionRepository({ db }: LiquidacionRepositoryDeps) {
    // Una fila por línea de venta (libro dentro de una transacción venta/
    // ventaConsignacion) en el rango, con el precio histórico ya guardado en
    // `libros_transacciones` (nunca el precio actual del libro).
    const getLineasVenta = async (userId: number, desde: Date, hasta: Date) => {
        return db
            .select({
                id_libro: librosTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                cantidad: librosTransaccionesTable.cantidad,
                precio: librosTransaccionesTable.precio
            })
            .from(librosTransaccionesTable)
            .innerJoin(transaccionesTable, eq(transaccionesTable.id, librosTransaccionesTable.id_transaccion))
            .innerJoin(librosTable, eq(librosTable.id_libro, librosTransaccionesTable.id_libro))
            .where(
                and(
                    eq(transaccionesTable.user, userId),
                    inArray(transaccionesTable.type, TIPOS_VENTA),
                    gte(transaccionesTable.fecha, desde),
                    lte(transaccionesTable.fecha, hasta)
                )
            );
    };

    // Personas (autor/ilustrador) asociadas a los libros vendidos, con el
    // porcentaje vigente (no hay historial de porcentaje en el sistema).
    const getPersonasPorLibro = async (idLibros: number[], userId: number) => {
        if (idLibros.length === 0) return [];

        return db
            .select({
                id_libro: librosPersonasTable.id_libro,
                id_persona: librosPersonasTable.id_persona,
                tipo: librosPersonasTable.tipo,
                porcentaje: librosPersonasTable.porcentaje,
                nombre: personasTable.nombre
            })
            .from(librosPersonasTable)
            .innerJoin(personasTable, eq(personasTable.id, librosPersonasTable.id_persona))
            .where(and(inArray(librosPersonasTable.id_libro, idLibros), eq(personasTable.user, userId)));
    };

    return {
        getLineasVenta,
        getPersonasPorLibro
    };
}

export type LiquidacionRepository = ReturnType<typeof createLiquidacionRepository>;
