import { Database } from "../../db/client";
import { AnticipoService } from "../anticipo";
import { LibroRepository } from "./libro.repository";
import { PersonaRepository } from "../persona/persona.repository";
import { RolRepository } from "../rol";
import { LibroPersonaRepository } from "./libroPersona.repository";
import { Duplicated, NotFound } from "bradb";
import { LibroPersonaBody, LibroPersonaRemoveBody } from "./libroPersona.validator";

export type LibroPersonaServiceDeps = {
    db: Database;
    repository: LibroPersonaRepository;
    libroRepository: LibroRepository;
    personaRepository: PersonaRepository;
    // Sólo lectura: valida que cada rol asignado exista, sea de la cuenta y
    // esté activo (404 del contrato, ver plan tarea 8).
    rolRepository: Pick<RolRepository, "findOne">;
    // Definir un monto acordado sobre un libro ya lanzado genera su anticipo
    // (una sola vez): lo resuelve el service de anticipos (ver
    // specs/012-liquidaciones-pagos, tarea 10).
    anticipoService: Pick<AnticipoService, "generarDeLibro">;
};

export function createLibroPersonaService({
    db,
    repository,
    libroRepository,
    personaRepository,
    rolRepository,
    anticipoService
}: LibroPersonaServiceDeps) {
    const uniqueIds = (items: { id_persona: number }[]): number[] =>
        Array.from(new Set(items.map((item) => item.id_persona)));

    // `findOne` de bradb da 404 si el rol no existe, es de otra cuenta o está
    // dado de baja: los tres casos de rechazo del contrato.
    const assertRolesDeLaCuenta = async (rolIds: number[], userId: number) => {
        for (const rolId of new Set(rolIds)) {
            await rolRepository.findOne({ id: rolId, user: userId });
        }
    };

    // Dos items del mismo request no pueden repetir la combinación persona +
    // rol: la PK (libro, persona, rol) los rechazaría con un error de base en
    // vez del 409 del contrato.
    const assertSinRepetidos = (items: LibroPersonaBody[]) => {
        const claves = items.map((item) => `${item.id_persona}:${item.rol}`);
        if (new Set(claves).size !== claves.length) {
            throw new Duplicated("Alguna persona ya trabaja en ese libro con ese rol");
        }
    };

    const addToLibro = async (isbn: string, userId: number, items: LibroPersonaBody[]) => {
        const libro = await libroRepository.findOne(isbn, userId);
        const ids = uniqueIds(items);

        const personas = await db.transaction(async (tx) => {
            await assertRolesDeLaCuenta(
                items.map((item) => item.rol),
                userId
            );
            assertSinRepetidos(items);

            const duplicadas = await repository.findExisting(libro.id_libro, items, tx);
            if (duplicadas.length > 0) {
                throw new Duplicated("Alguna persona ya trabaja en ese libro con ese rol");
            }

            const personasPropias = await personaRepository.findOwnedIds(ids, userId);
            if (personasPropias.length < ids.length) {
                throw new NotFound("Alguna persona no existe");
            }

            const insertadas = await repository.insertMany(libro.id_libro, libro.isbn, items, tx);

            if (items.some((item) => item.monto_acordado != null)) {
                await anticipoService.generarDeLibro(libro.id_libro, userId, tx);
            }

            return insertadas;
        });

        return { libro, personas };
    };

    const updateInLibro = async (isbn: string, userId: number, items: LibroPersonaBody[]) => {
        // Sólo se valida dueño del libro, no de cada persona: una fila de
        // `libros_personas` sólo pudo nacer bajo el `POST` de este mismo
        // servicio, que ya validó ambas puntas (ver plan, "Decisiones y trade-offs").
        const libro = await libroRepository.findOne(isbn, userId);

        const personas = await db.transaction(async (tx) => {
            await assertRolesDeLaCuenta(
                items.map((item) => item.rol),
                userId
            );

            const existentes = await repository.findExisting(libro.id_libro, items, tx);
            if (existentes.length < items.length) {
                throw new NotFound("Alguna persona no trabaja en este libro con ese rol");
            }

            const actualizadas = [];
            for (const item of items) {
                // Sin chequeo de verdad sobre `item.porcentaje`: el schema ya lo
                // exige presente (incluyendo 0), así que siempre se aplica tal
                // cual viene (ver spec/plan: corrección del bug de porcentaje 0).
                actualizadas.push(await repository.updateParticipacion(libro.id_libro, item, tx));
            }

            await anticipoService.generarDeLibro(libro.id_libro, userId, tx);

            return actualizadas;
        });

        return { libro, personas };
    };

    const removeFromLibro = async (isbn: string, userId: number, items: LibroPersonaRemoveBody[]) => {
        const libro = await libroRepository.findOne(isbn, userId);

        await db.transaction(async (tx) => {
            const existentes = await repository.findExisting(libro.id_libro, items, tx);
            if (existentes.length < items.length) {
                throw new NotFound("Alguna persona no trabaja en este libro con ese rol");
            }

            await repository.removeMany(libro.id_libro, items, tx);
        });

        return { libro, personas: items };
    };

    return {
        addToLibro,
        updateInLibro,
        removeFromLibro
    };
}

export type LibroPersonaService = ReturnType<typeof createLibroPersonaService>;
