import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { ServiceBuilder, Pagination } from "bradb";
import { Database } from "../../db/client";
import { personasTable } from "./persona.schema";
import { librosPersonasTable } from "../libro/libroPersona.schema";
import { librosTable } from "../libro/libro.schema";
import { personaFilterMap } from "./persona.filter";
import { TipoPersona } from "../libro/libroPersona.validator";

export type PersonaRepositoryDeps = {
    db: Database;
};

export function createPersonaRepository({ db }: PersonaRepositoryDeps) {
    const builder = new ServiceBuilder(db, personasTable, personaFilterMap);

    const findOne = builder.findOne();
    const insert = builder.create();
    const update = builder.update();
    const remove = builder.delete();

    const exists = async (dni: string, userId: number): Promise<boolean> => {
        const rows = await db
            .select({ id: personasTable.id })
            .from(personasTable)
            .where(
                and(
                    eq(personasTable.dni, dni),
                    eq(personasTable.user, userId),
                    isNull(personasTable.deletedAt)
                )
            )
            .limit(1);

        return rows.length > 0;
    };

    const findAllPaginated = builder.findAll(true);
    const findAll = async (userId: number, pagination: Pagination) => {
        return findAllPaginated({ user: userId }, pagination);
    };

    const buildQueryByTipo = (tipo: TipoPersona, userId: number) =>
        db
            .selectDistinctOn([personasTable.id], {
                id: personasTable.id,
                dni: personasTable.dni,
                nombre: personasTable.nombre,
                email: personasTable.email,
                user: personasTable.user
            })
            .from(personasTable)
            .innerJoin(librosPersonasTable, eq(librosPersonasTable.id_persona, personasTable.id))
            .where(
                and(
                    isNull(personasTable.deletedAt),
                    eq(librosPersonasTable.tipo, tipo),
                    eq(personasTable.user, userId)
                )
            )
            .$dynamic();

    const getAllByTipo = async (tipo: TipoPersona, userId: number, pagination: Pagination) => {
        const sub = buildQueryByTipo(tipo, userId).as("sub");
        const [{ count: total }] = await db.select({ count: count() }).from(sub);

        const offset = (pagination.page - 1) * pagination.pageSize;
        const items = await buildQueryByTipo(tipo, userId).limit(pagination.pageSize).offset(offset);

        pagination.total = total;
        pagination.count = items.length;

        return items;
    };

    // Usada por otros módulos (ej. libroPersona) para validar de una sola vez
    // que un conjunto de ids de persona existen y son del mismo usuario.
    const findOwnedIds = async (ids: number[], userId: number): Promise<number[]> => {
        const rows = await db
            .select({ id: personasTable.id })
            .from(personasTable)
            .where(and(inArray(personasTable.id, ids), eq(personasTable.user, userId), isNull(personasTable.deletedAt)));

        return rows.map((r) => r.id);
    };

    const getLibros = async (personaId: number, userId: number) => {
        return db
            .select({
                id_libro: librosTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                fecha_edicion: librosTable.fecha_edicion,
                precio: librosTable.precio,
                stock: librosTable.stock,
                user: librosTable.user,
                tipo: librosPersonasTable.tipo
            })
            .from(librosTable)
            .innerJoin(librosPersonasTable, eq(librosTable.isbn, librosPersonasTable.isbn))
            .where(
                and(
                    eq(librosPersonasTable.id_persona, personaId),
                    eq(librosTable.user, userId)
                )
            );
    };

    return {
        findOne,
        insert,
        update,
        remove,
        exists,
        findAll,
        getAllByTipo,
        findOwnedIds,
        getLibros
    };
}

export type PersonaRepository = ReturnType<typeof createPersonaRepository>;
