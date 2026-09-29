import { and, count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NotFound } from "bradb";
import { Database, Tx } from "../../db/client";
import { movimientosTable, movimientosLibrosTable } from "./movimiento.schema";
import { depositosTable } from "../deposito/deposito.schema";
import { librosTable } from "../libro/libro.schema";

export type MovimientoRepositoryDeps = {
    db: Database;
};

export type LibroEnMovimiento = {
    isbn: string;
    titulo: string;
    cantidad: number;
};

// Fila de movimiento con los nombres de depósito ya resueltos por join (el
// nombre sigue disponible aunque el depósito se haya dado de baja lógica).
export type MovimientoConNombres = {
    id: number;
    fecha: Date;
    origen_tipo: string;
    origen_deposito_id: number | null;
    destino_tipo: string;
    destino_deposito_id: number | null;
    user: number;
    origen_nombre: string | null;
    destino_nombre: string | null;
    libros: LibroEnMovimiento[];
};

export function createMovimientoRepository({ db }: MovimientoRepositoryDeps) {
    const origenDep = alias(depositosTable, "origen_deposito");
    const destinoDep = alias(depositosTable, "destino_deposito");

    const selectBase = () =>
        db
            .select({
                id: movimientosTable.id,
                fecha: movimientosTable.fecha,
                origen_tipo: movimientosTable.origen_tipo,
                origen_deposito_id: movimientosTable.origen_deposito_id,
                destino_tipo: movimientosTable.destino_tipo,
                destino_deposito_id: movimientosTable.destino_deposito_id,
                user: movimientosTable.user,
                origen_nombre: origenDep.nombre,
                destino_nombre: destinoDep.nombre
            })
            .from(movimientosTable)
            .leftJoin(
                origenDep,
                and(eq(origenDep.id, movimientosTable.origen_deposito_id), eq(origenDep.user, movimientosTable.user))
            )
            .leftJoin(
                destinoDep,
                and(eq(destinoDep.id, movimientosTable.destino_deposito_id), eq(destinoDep.user, movimientosTable.user))
            )
            .$dynamic();

    // Una sola query para los libros de toda la página (evita N+1): el listado
    // ya trae sus libros, el detalle de una fila no necesita otra consulta.
    const getLibros = async (movimientoIds: number[], userId: number): Promise<Map<number, LibroEnMovimiento[]>> => {
        if (movimientoIds.length === 0) return new Map();

        const rows = await db
            .select({
                movimiento_id: movimientosLibrosTable.movimiento_id,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                cantidad: movimientosLibrosTable.cantidad
            })
            .from(movimientosLibrosTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, movimientosLibrosTable.id_libro), eq(librosTable.user, movimientosLibrosTable.user))
            )
            .where(and(inArray(movimientosLibrosTable.movimiento_id, movimientoIds), eq(movimientosLibrosTable.user, userId)));

        const porMovimiento = new Map<number, LibroEnMovimiento[]>();
        for (const row of rows) {
            const libros = porMovimiento.get(row.movimiento_id) ?? [];
            libros.push({ isbn: row.isbn, titulo: row.titulo, cantidad: row.cantidad });
            porMovimiento.set(row.movimiento_id, libros);
        }

        return porMovimiento;
    };

    const getAll = async (userId: number, offset: number, limit: number) => {
        const [rows, [{ count: total }]] = await Promise.all([
            selectBase().where(eq(movimientosTable.user, userId)).orderBy(desc(movimientosTable.id)).limit(limit).offset(offset),
            db.select({ count: count() }).from(movimientosTable).where(eq(movimientosTable.user, userId))
        ]);

        const libros = await getLibros(rows.map((row) => row.id), userId);

        return {
            movimientos: rows.map((row) => ({ ...row, libros: libros.get(row.id) ?? [] })),
            total
        };
    };

    const getById = async (id: number, userId: number): Promise<MovimientoConNombres> => {
        const rows = await selectBase().where(and(eq(movimientosTable.id, id), eq(movimientosTable.user, userId)));

        if (rows.length === 0) throw new NotFound(`No se encontró el movimiento con id ${id}`);

        const libros = await getLibros([id], userId);
        return { ...rows[0], libros: libros.get(id) ?? [] };
    };

    const insert = async (body: typeof movimientosTable.$inferInsert, tx: Tx) => {
        const [row] = await tx.insert(movimientosTable).values(body).returning();
        return row;
    };

    const insertLibros = async (
        movimientoId: number,
        userId: number,
        libros: { id_libro: number; cantidad: number }[],
        tx: Tx
    ): Promise<void> => {
        await tx.insert(movimientosLibrosTable).values(
            libros.map((libro) => ({
                movimiento_id: movimientoId,
                id_libro: libro.id_libro,
                cantidad: libro.cantidad,
                user: userId
            }))
        );
    };

    return {
        getAll,
        getById,
        insert,
        insertLibros
    };
}

export type MovimientoRepository = ReturnType<typeof createMovimientoRepository>;
