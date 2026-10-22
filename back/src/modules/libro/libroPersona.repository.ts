import { and, eq, or } from "drizzle-orm";
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
    // La identidad de una participación es la terna libro + persona + rol: dos
    // items coinciden si comparten persona y rol (el libro es el de la query).
    const porPersonaYRol = (items: { id_persona: number; rol: number }[]) =>
        items.map((item) => and(eq(librosPersonasTable.id_persona, item.id_persona), eq(librosPersonasTable.id_rol, item.rol)));

    const findExisting = async (idLibro: number, items: LibroPersonaRemoveBody[], tx?: Tx) => {
        return (tx ?? db)
            .select({ id_persona: librosPersonasTable.id_persona, id_rol: librosPersonasTable.id_rol })
            .from(librosPersonasTable)
            .where(and(eq(librosPersonasTable.id_libro, idLibro), or(...porPersonaYRol(items))));
    };

    const insertMany = async (idLibro: number, isbn: string, items: LibroPersonaBody[], tx?: Tx) => {
        return (tx ?? db)
            .insert(librosPersonasTable)
            .values(
                items.map((item) => ({
                    id_persona: item.id_persona,
                    id_rol: item.rol,
                    porcentaje: item.porcentaje,
                    monto_acordado: item.monto_acordado ?? null,
                    isbn,
                    id_libro: idLibro
                }))
            )
            .returning();
    };

    const updateParticipacion = async (idLibro: number, item: LibroPersonaBody, tx?: Tx) => {
        const [actualizada] = await (tx ?? db)
            .update(librosPersonasTable)
            .set({
                porcentaje: item.porcentaje,
                // Sin `monto_acordado` en el body se deja el valor actual.
                ...(item.monto_acordado === undefined ? {} : { monto_acordado: item.monto_acordado })
            })
            .where(
                and(
                    eq(librosPersonasTable.id_libro, idLibro),
                    eq(librosPersonasTable.id_persona, item.id_persona),
                    eq(librosPersonasTable.id_rol, item.rol)
                )
            )
            .returning();

        return actualizada;
    };

    const removeMany = async (idLibro: number, items: LibroPersonaRemoveBody[], tx?: Tx) => {
        await (tx ?? db)
            .delete(librosPersonasTable)
            .where(and(eq(librosPersonasTable.id_libro, idLibro), or(...porPersonaYRol(items))));
    };

    return {
        findExisting,
        insertMany,
        updateParticipacion,
        removeMany
    };
}

export type LibroPersonaRepository = ReturnType<typeof createLibroPersonaRepository>;
