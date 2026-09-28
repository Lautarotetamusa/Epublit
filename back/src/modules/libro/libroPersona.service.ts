import { Database } from "../../db/client";
import { LibroRepository } from "./libro.repository";
import { PersonaRepository } from "../persona/persona.repository";
import { LibroPersonaRepository } from "./libroPersona.repository";
import { Duplicated, NotFound } from "bradb";
import { LibroPersonaBody, LibroPersonaRemoveBody } from "./libroPersona.validator";

export type LibroPersonaServiceDeps = {
    db: Database;
    repository: LibroPersonaRepository;
    libroRepository: LibroRepository;
    personaRepository: PersonaRepository;
};

export function createLibroPersonaService({ db, repository, libroRepository, personaRepository }: LibroPersonaServiceDeps) {
    const uniqueIds = (items: { id_persona: number }[]): number[] =>
        Array.from(new Set(items.map((item) => item.id_persona)));

    const addToLibro = async (isbn: string, userId: number, items: LibroPersonaBody[]) => {
        const libro = await libroRepository.findOne(isbn, userId);
        const ids = uniqueIds(items);

        const personas = await db.transaction(async (tx) => {
            const duplicadas = await repository.findExistingIds(libro.id_libro, ids, tx);
            if (duplicadas.length > 0) {
                throw new Duplicated("Alguna persona ya trabaja en ese libro");
            }

            const personasPropias = await personaRepository.findOwnedIds(ids, userId);
            if (personasPropias.length < ids.length) {
                throw new NotFound("Alguna persona no existe");
            }

            return repository.insertMany(libro.id_libro, libro.isbn, items, tx);
        });

        return { libro, personas };
    };

    const updateInLibro = async (isbn: string, userId: number, items: LibroPersonaBody[]) => {
        // Sólo se valida dueño del libro, no de cada persona: una fila de
        // `libros_personas` sólo pudo nacer bajo el `POST` de este mismo
        // servicio, que ya validó ambas puntas (ver plan, "Decisiones y trade-offs").
        const libro = await libroRepository.findOne(isbn, userId);

        const personas = await db.transaction(async (tx) => {
            const existentes = await repository.findExisting(libro.id_libro, items, tx);
            if (existentes.length < items.length) {
                throw new NotFound("Alguna persona no trabaja en este libro");
            }

            const actualizadas = [];
            for (const item of items) {
                // Sin chequeo de verdad sobre `item.porcentaje`: el schema ya lo
                // exige presente (incluyendo 0), así que siempre se aplica tal
                // cual viene (ver spec/plan: corrección del bug de porcentaje 0).
                actualizadas.push(await repository.updatePorcentaje(libro.id_libro, item, tx));
            }

            return actualizadas;
        });

        return { libro, personas };
    };

    const removeFromLibro = async (isbn: string, userId: number, items: LibroPersonaRemoveBody[]) => {
        const libro = await libroRepository.findOne(isbn, userId);

        // Sin validar existencia previa ni envolver en transacción: borrar una
        // asociación inexistente no debe fallar (comportamiento actual a preservar).
        await repository.removeMany(libro.id_libro, items);

        return { libro, personas: items };
    };

    return {
        addToLibro,
        updateInLibro,
        removeFromLibro
    };
}

export type LibroPersonaService = ReturnType<typeof createLibroPersonaService>;
