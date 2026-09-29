import { and, asc, count, eq, isNotNull, isNull } from "drizzle-orm";
import { Pagination, ServiceBuilder } from "bradb";
import { Database } from "../../db/client";
import { coleccionesTable } from "./coleccion.schema";
import { librosTable } from "../libro/libro.schema";
import { coleccionFilterMap } from "./coleccion.filter";

export type ColeccionRepositoryDeps = {
    db: Database;
};

export function createColeccionRepository({ db }: ColeccionRepositoryDeps) {
    const builder = new ServiceBuilder(db, coleccionesTable, coleccionFilterMap);

    const findOne = builder.findOne();
    const insert = builder.create();
    const update = builder.update();
    const remove = builder.delete();
    // Sin paginar: el listado de colecciones de un usuario es corto (el plan
    // no lo pagina) y el front lo usa entero para el selector de libro.
    const findAll = builder.findAll(false);

    const countLibros = async (coleccionId: number, userId: number): Promise<number> => {
        const [row] = await db
            .select({ count: count() })
            .from(librosTable)
            .where(
                and(
                    eq(librosTable.coleccion_id, coleccionId),
                    eq(librosTable.user, userId),
                    isNull(librosTable.deletedAt)
                )
            );

        return row.count;
    };

    // Una sola query para todas las colecciones (con `group by`) en vez de
    // contar colección por colección: evita N+1 en el listado.
    const countLibrosByColeccion = async (userId: number): Promise<Map<number, number>> => {
        const rows = await db
            .select({ coleccion_id: librosTable.coleccion_id, count: count() })
            .from(librosTable)
            .where(
                and(
                    eq(librosTable.user, userId),
                    isNull(librosTable.deletedAt),
                    isNotNull(librosTable.coleccion_id)
                )
            )
            .groupBy(librosTable.coleccion_id);

        return new Map(rows.map((row) => [row.coleccion_id as number, row.count]));
    };

    const buildLibrosQuery = (coleccionId: number, userId: number) =>
        db
            .select({
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                precio: librosTable.precio,
                portada_key: librosTable.portada_key
            })
            .from(librosTable)
            .where(
                and(
                    eq(librosTable.coleccion_id, coleccionId),
                    eq(librosTable.user, userId),
                    isNull(librosTable.deletedAt)
                )
            )
            .orderBy(asc(librosTable.titulo))
            .$dynamic();

    const findLibrosPaginated = async (coleccionId: number, userId: number, pagination: Pagination) => {
        const sub = buildLibrosQuery(coleccionId, userId).as("sub");
        const [{ count: total }] = await db.select({ count: count() }).from(sub);

        const offset = (pagination.page - 1) * pagination.pageSize;
        const items = await buildLibrosQuery(coleccionId, userId).limit(pagination.pageSize).offset(offset);

        pagination.total = total;
        pagination.count = items.length;

        return items;
    };

    return {
        findOne,
        insert,
        update,
        remove,
        findAll,
        countLibros,
        countLibrosByColeccion,
        findLibrosPaginated
    };
}

export type ColeccionRepository = ReturnType<typeof createColeccionRepository>;
