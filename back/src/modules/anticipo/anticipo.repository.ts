import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { anticiposTable } from "./anticipo.schema";
import { movimientosTable, movimientosLibrosTable } from "../movimiento/movimiento.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { librosTable } from "../libro/libro.schema";
import { librosPersonasTable } from "../libro/libroPersona.schema";
import { personasTable } from "../persona/persona.schema";
import { rolesTable } from "../rol/rol.schema";

export type AnticipoRepositoryDeps = {
    db: Database;
};

export type AnticipoConDatos = {
    id: number;
    id_libro: number;
    isbn: string;
    titulo: string;
    id_persona: number;
    nombre: string;
    id_rol: number;
    rol: string;
    monto: number;
    fecha_lanzamiento: Date | string;
    pagado: boolean;
    fecha_pago: Date | string | null;
};

export function createAnticipoRepository({ db }: AnticipoRepositoryDeps) {
    // Fecha del lanzamiento: primera incorporación de stock del libro (un
    // movimiento exterior → depósito principal de la cuenta, ver
    // specs/012-liquidaciones-pagos, tarea 10). `null` mientras el libro no
    // se lanzó.
    const getFechaLanzamiento = async (idLibro: number, userId: number, tx?: Tx): Promise<Date | null> => {
        const rows = await (tx ?? db)
            .select({ fecha: movimientosTable.fecha })
            .from(movimientosTable)
            .innerJoin(
                movimientosLibrosTable,
                and(
                    eq(movimientosLibrosTable.movimiento_id, movimientosTable.id),
                    eq(movimientosLibrosTable.user, movimientosTable.user)
                )
            )
            .innerJoin(
                depositosTable,
                and(eq(depositosTable.id, movimientosTable.destino_deposito_id), eq(depositosTable.user, movimientosTable.user))
            )
            .where(
                and(
                    eq(movimientosTable.user, userId),
                    eq(movimientosTable.tipo, "ingreso"),
                    eq(movimientosTable.origen_tipo, "exterior"),
                    eq(depositosTable.principal, true),
                    eq(movimientosLibrosTable.id_libro, idLibro)
                )
            )
            .orderBy(asc(movimientosTable.fecha), asc(movimientosTable.id))
            .limit(1);

        return rows[0]?.fecha ?? null;
    };

    // Participaciones del libro con monto acordado: cada una genera (a lo
    // sumo) un anticipo. El join a `libros` es para scopear por dueño: la
    // tabla de la relación no tiene `user` propio.
    const getAcuerdosConMonto = async (idLibro: number, userId: number, tx?: Tx) => {
        return (tx ?? db)
            .select({
                id_persona: librosPersonasTable.id_persona,
                id_rol: librosPersonasTable.id_rol,
                monto_acordado: librosPersonasTable.monto_acordado
            })
            .from(librosPersonasTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, librosPersonasTable.id_libro), eq(librosTable.user, userId))
            )
            .where(and(eq(librosPersonasTable.id_libro, idLibro), isNotNull(librosPersonasTable.monto_acordado)));
    };

    // Idempotente por la unique (libro, persona, rol, user): reintentar la
    // generación (una reimpresión, o definir el monto después de lanzado) no
    // duplica el anticipo.
    const insertMany = async (
        rows: (typeof anticiposTable.$inferInsert)[],
        tx?: Tx
    ): Promise<void> => {
        if (rows.length === 0) return;

        await (tx ?? db)
            .insert(anticiposTable)
            .values(rows)
            .onConflictDoNothing({
                target: [anticiposTable.id_libro, anticiposTable.id_persona, anticiposTable.id_rol, anticiposTable.user]
            });
    };

    const selectBase = () =>
        db
            .select({
                id: anticiposTable.id,
                id_libro: anticiposTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                id_persona: anticiposTable.id_persona,
                nombre: personasTable.nombre,
                id_rol: anticiposTable.id_rol,
                rol: rolesTable.nombre,
                monto: anticiposTable.monto,
                fecha_lanzamiento: anticiposTable.fecha_lanzamiento,
                pagado: anticiposTable.pagado,
                fecha_pago: anticiposTable.fecha_pago
            })
            .from(anticiposTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, anticiposTable.id_libro), eq(librosTable.user, anticiposTable.user))
            )
            .innerJoin(personasTable, eq(personasTable.id, anticiposTable.id_persona))
            // Sin filtrar `deleted_at`: el nombre del rol sigue siendo
            // resoluble en los anticipos históricos.
            .innerJoin(rolesTable, eq(rolesTable.id, anticiposTable.id_rol))
            .$dynamic();

    const findActivos = async (userId: number): Promise<AnticipoConDatos[]> => {
        return selectBase().where(eq(anticiposTable.user, userId)).orderBy(asc(anticiposTable.id));
    };

    // Incorporaciones de stock del libro al depósito principal (incluye el
    // lanzamiento): las reimpresiones se derivan de acá, no hay tabla propia.
    const getIncorporacionesPorLibro = async (userId: number): Promise<{ id_libro: number; cantidad: number }[]> => {
        return db
            .select({
                id_libro: movimientosLibrosTable.id_libro,
                cantidad: count().mapWith(Number)
            })
            .from(movimientosTable)
            .innerJoin(
                movimientosLibrosTable,
                and(
                    eq(movimientosLibrosTable.movimiento_id, movimientosTable.id),
                    eq(movimientosLibrosTable.user, movimientosTable.user)
                )
            )
            .innerJoin(
                depositosTable,
                and(eq(depositosTable.id, movimientosTable.destino_deposito_id), eq(depositosTable.user, movimientosTable.user))
            )
            .where(
                and(
                    eq(movimientosTable.user, userId),
                    eq(movimientosTable.tipo, "ingreso"),
                    eq(movimientosTable.origen_tipo, "exterior"),
                    eq(depositosTable.principal, true)
                )
            )
            .groupBy(movimientosLibrosTable.id_libro);
    };

    const findOne = async (id: number, userId: number): Promise<AnticipoConDatos | null> => {
        const rows = await selectBase().where(and(eq(anticiposTable.id, id), eq(anticiposTable.user, userId)));

        return rows[0] ?? null;
    };

    const marcarPagado = async (id: number, userId: number, fecha: string): Promise<void> => {
        await db
            .update(anticiposTable)
            .set({ pagado: true, fecha_pago: fecha })
            .where(and(eq(anticiposTable.id, id), eq(anticiposTable.user, userId)));
    };

    return {
        getFechaLanzamiento,
        getAcuerdosConMonto,
        insertMany,
        findActivos,
        getIncorporacionesPorLibro,
        findOne,
        marcarPagado
    };
}

export type AnticipoRepository = ReturnType<typeof createAnticipoRepository>;
