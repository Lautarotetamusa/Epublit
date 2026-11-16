import { and, asc, eq } from "drizzle-orm";
import { NotFound } from "bradb";
import { Database } from "../../db/client";
import { libroResenasTable } from "./libroResena.schema";

export type LibroResenaRepositoryDeps = {
    db: Database;
};

const columnasPublicas = {
    id: libroResenasTable.id,
    url: libroResenasTable.url,
    created_at: libroResenasTable.created_at
};

export function createLibroResenaRepository({ db }: LibroResenaRepositoryDeps) {
    const findByLibro = (idLibro: number, userId: number) =>
        db
            .select(columnasPublicas)
            .from(libroResenasTable)
            .where(and(eq(libroResenasTable.id_libro, idLibro), eq(libroResenasTable.user, userId)))
            .orderBy(asc(libroResenasTable.id));

    const insert = async (idLibro: number, url: string, userId: number) => {
        const [row] = await db
            .insert(libroResenasTable)
            .values({ id_libro: idLibro, url, user: userId })
            .returning(columnasPublicas);
        return row;
    };

    // El WHERE por libro + usuario hace que una reseña de otro libro u otra
    // cuenta sea un 404, aunque se adivine el id.
    const deLaResena = (id: number, idLibro: number, userId: number) =>
        and(eq(libroResenasTable.id, id), eq(libroResenasTable.id_libro, idLibro), eq(libroResenasTable.user, userId));

    const update = async (id: number, idLibro: number, url: string, userId: number) => {
        const [row] = await db
            .update(libroResenasTable)
            .set({ url })
            .where(deLaResena(id, idLibro, userId))
            .returning(columnasPublicas);
        if (!row) throw new NotFound(`No existe la reseña con id ${id}`);
        return row;
    };

    const remove = async (id: number, idLibro: number, userId: number): Promise<void> => {
        const rows = await db.delete(libroResenasTable).where(deLaResena(id, idLibro, userId)).returning({ id: libroResenasTable.id });
        if (rows.length === 0) throw new NotFound(`No existe la reseña con id ${id}`);
    };

    return { findByLibro, insert, update, remove };
}

export type LibroResenaRepository = ReturnType<typeof createLibroResenaRepository>;
