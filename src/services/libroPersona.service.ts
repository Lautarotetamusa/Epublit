import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "../pgDb";
import { librosPersonasTable } from "../schemas/librosPersonas.schema";
import { personasTable } from "../schemas/personas.schema";
import { libroService } from "./libro.service";
import { Duplicated, NotFound } from "../models/errors";
import { LibroPersonaBody, LibroPersonaRemoveBody } from "../validators/libro_persona.validator";

// `libros_personas` no tiene columna `user` propia (ver plan, "Modelo de
// datos"): el dueño se hereda del libro y de cada persona referenciados, así
// que ese chequeo no lo puede dar una PK/ServiceBuilder por sí sola y se hace
// explícito acá en vez de con `ServiceBuilder`.

const uniqueIds = (items: { id_persona: number }[]): number[] =>
    Array.from(new Set(items.map((item) => item.id_persona)));

const addToLibro = async (isbn: string, userId: number, items: LibroPersonaBody[]) => {
    const libro = await libroService.findOne(isbn, userId);
    const ids = uniqueIds(items);

    const personas = await db.transaction(async (tx) => {
        const duplicadas = await tx
            .select({ id_persona: librosPersonasTable.id_persona })
            .from(librosPersonasTable)
            .where(and(eq(librosPersonasTable.id_libro, libro.id_libro), inArray(librosPersonasTable.id_persona, ids)));

        if (duplicadas.length > 0) {
            throw new Duplicated("Alguna persona ya trabaja en ese libro");
        }

        const personasPropias = await tx
            .select({ id: personasTable.id })
            .from(personasTable)
            .where(and(inArray(personasTable.id, ids), eq(personasTable.user, userId), isNull(personasTable.deletedAt)));

        if (personasPropias.length < ids.length) {
            throw new NotFound("Alguna persona no existe");
        }

        return tx
            .insert(librosPersonasTable)
            .values(items.map((item) => ({ ...item, isbn: libro.isbn, id_libro: libro.id_libro })))
            .returning();
    });

    return { libro, personas };
};

const updateInLibro = async (isbn: string, userId: number, items: LibroPersonaBody[]) => {
    // Sólo se valida dueño del libro, no de cada persona: una fila de
    // `libros_personas` sólo pudo nacer bajo el `POST` de este mismo
    // servicio, que ya validó ambas puntas (ver plan, "Decisiones y trade-offs").
    const libro = await libroService.findOne(isbn, userId);

    const personas = await db.transaction(async (tx) => {
        const existentes = await tx
            .select({ id_persona: librosPersonasTable.id_persona, tipo: librosPersonasTable.tipo })
            .from(librosPersonasTable)
            .where(
                and(
                    eq(librosPersonasTable.id_libro, libro.id_libro),
                    or(...items.map((item) => and(eq(librosPersonasTable.id_persona, item.id_persona), eq(librosPersonasTable.tipo, item.tipo))))
                )
            );

        if (existentes.length < items.length) {
            throw new NotFound("Alguna persona no trabaja en este libro");
        }

        const actualizadas = [];
        for (const item of items) {
            // Sin chequeo de verdad sobre `item.porcentaje`: el schema ya lo
            // exige presente (incluyendo 0), así que siempre se aplica tal
            // cual viene (ver spec/plan: corrección del bug de porcentaje 0).
            const [actualizada] = await tx
                .update(librosPersonasTable)
                .set({ porcentaje: item.porcentaje })
                .where(
                    and(
                        eq(librosPersonasTable.id_libro, libro.id_libro),
                        eq(librosPersonasTable.id_persona, item.id_persona),
                        eq(librosPersonasTable.tipo, item.tipo)
                    )
                )
                .returning();
            actualizadas.push(actualizada);
        }

        return actualizadas;
    });

    return { libro, personas };
};

const removeFromLibro = async (isbn: string, userId: number, items: LibroPersonaRemoveBody[]) => {
    const libro = await libroService.findOne(isbn, userId);

    // Sin validar existencia previa ni envolver en transacción: borrar una
    // asociación inexistente no debe fallar (comportamiento actual a preservar).
    await db
        .delete(librosPersonasTable)
        .where(
            and(
                eq(librosPersonasTable.id_libro, libro.id_libro),
                or(...items.map((item) => and(eq(librosPersonasTable.id_persona, item.id_persona), eq(librosPersonasTable.tipo, item.tipo))))
            )
        );

    return { libro, personas: items };
};

export const libroPersonaService = {
    addToLibro,
    updateInLibro,
    removeFromLibro
};
