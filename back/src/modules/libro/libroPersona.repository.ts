import { and, eq, inArray, or } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { librosPersonasTable } from "./libroPersona.schema";
import { LibroPersonaBody, LibroPersonaRemoveBody } from "./libroPersona.validator";

export type LibroPersonaRepositoryDeps = {
    db: Database;
};

// `libros_personas` no tiene columna `user` propia (ver plan, "Modelo de
// datos"): el dueño se hereda del libro y de cada persona referenciados, así
// que ese chequeo no lo puede dar una PK/ServiceBuilder por sí sola y se hace
// explícito en el service, no acá.
export function createLibroPersonaRepository({ db }: LibroPersonaRepositoryDeps) {
    const findExistingIds = async (idLibro: number, ids: number[], tx?: Tx) => {
        return (tx ?? db)
            .select({ id_persona: librosPersonasTable.id_persona })
            .from(librosPersonasTable)
            .where(and(eq(librosPersonasTable.id_libro, idLibro), inArray(librosPersonasTable.id_persona, ids)));
    };

    const findExisting = async (idLibro: number, items: LibroPersonaBody[], tx?: Tx) => {
        return (tx ?? db)
            .select({ id_persona: librosPersonasTable.id_persona, tipo: librosPersonasTable.tipo })
            .from(librosPersonasTable)
            .where(
                and(
                    eq(librosPersonasTable.id_libro, idLibro),
                    or(...items.map((item) => and(eq(librosPersonasTable.id_persona, item.id_persona), eq(librosPersonasTable.tipo, item.tipo))))
                )
            );
    };

    const insertMany = async (idLibro: number, isbn: string, items: LibroPersonaBody[], tx?: Tx) => {
        return (tx ?? db)
            .insert(librosPersonasTable)
            .values(items.map((item) => ({ ...item, isbn, id_libro: idLibro })))
            .returning();
    };

    const updatePorcentaje = async (idLibro: number, item: LibroPersonaBody, tx?: Tx) => {
        const [actualizada] = await (tx ?? db)
            .update(librosPersonasTable)
            .set({ porcentaje: item.porcentaje })
            .where(
                and(
                    eq(librosPersonasTable.id_libro, idLibro),
                    eq(librosPersonasTable.id_persona, item.id_persona),
                    eq(librosPersonasTable.tipo, item.tipo)
                )
            )
            .returning();

        return actualizada;
    };

    const removeMany = async (idLibro: number, items: LibroPersonaRemoveBody[]) => {
        await db
            .delete(librosPersonasTable)
            .where(
                and(
                    eq(librosPersonasTable.id_libro, idLibro),
                    or(...items.map((item) => and(eq(librosPersonasTable.id_persona, item.id_persona), eq(librosPersonasTable.tipo, item.tipo))))
                )
            );
    };

    return {
        findExistingIds,
        findExisting,
        insertMany,
        updatePorcentaje,
        removeMany
    };
}

export type LibroPersonaRepository = ReturnType<typeof createLibroPersonaRepository>;
