import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { ServiceBuilder, Pagination } from "bradb";
import { Database } from "../../db/client";
import { personasTable } from "./persona.schema";
import { librosPersonasTable } from "../libro/libroPersona.schema";
import { librosTable } from "../libro/libro.schema";
import { rolesTable } from "../rol/rol.schema";
import { stockDeLibro } from "../libro/libro.stock";
import { personaFilterMap } from "./persona.filter";

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

    // Personas que participan de al menos un libro con ese rol de la cuenta
    // (ver specs/011-roles, tarea 10). El ownership del rol lo valida el
    // service antes de llegar acá.
    const buildQueryByRol = (rolId: number, userId: number) =>
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
                    eq(librosPersonasTable.id_rol, rolId),
                    eq(personasTable.user, userId)
                )
            )
            .$dynamic();

    const getAllByRol = async (rolId: number, userId: number, pagination: Pagination) => {
        const sub = buildQueryByRol(rolId, userId).as("sub");
        const [{ count: total }] = await db.select({ count: count() }).from(sub);

        const offset = (pagination.page - 1) * pagination.pageSize;
        const items = await buildQueryByRol(rolId, userId).limit(pagination.pageSize).offset(offset);

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
        const filas = await db
            .select({
                id_libro: librosTable.id_libro,
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                fecha_edicion: librosTable.fecha_edicion,
                precio: librosTable.precio,
                stock: stockDeLibro(),
                user: librosTable.user,
                rol_id: rolesTable.id,
                rol_nombre: rolesTable.nombre
            })
            .from(librosTable)
            .innerJoin(librosPersonasTable, eq(librosTable.isbn, librosPersonasTable.isbn))
            // Sin filtrar por `deleted_at`: un rol dado de baja sigue mostrando
            // su nombre en las relaciones históricas que lo referencian.
            .innerJoin(rolesTable, and(eq(rolesTable.id, librosPersonasTable.id_rol), eq(rolesTable.user, userId)))
            .where(
                and(
                    eq(librosPersonasTable.id_persona, personaId),
                    eq(librosTable.user, userId)
                )
            );

        return filas.map(({ rol_id, rol_nombre, ...libro }) => ({ ...libro, rol: { id: rol_id, nombre: rol_nombre } }));
    };

    return {
        findOne,
        insert,
        update,
        remove,
        exists,
        findAll,
        getAllByRol,
        findOwnedIds,
        getLibros
    };
}

export type PersonaRepository = ReturnType<typeof createPersonaRepository>;
