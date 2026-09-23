import { and, eq, isNull } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { db } from "../pgDb";
import { personasTable } from "../schemas/personas.schema";
import { librosPersonasTable } from "../schemas/librosPersonas.schema";
import { librosTable } from "../schemas/libros.schema";
import { personaFilterMap } from "../filters/persona.filter";
import { TipoPersona } from "../validators/libro_persona.validator";

const builder = new ServiceBuilder(db, personasTable, personaFilterMap);

const findOne = builder.findOne();
const create = builder.create();
const update = builder.update();
const remove = builder.delete();

const findAllRaw = builder.findAll(false);
const findAll = async (userId: number) => {
    return findAllRaw({ user: userId });
};

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

const getAllByTipo = async (tipo: TipoPersona, userId: number) => {
    return db
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
        );
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

export const personaService = {
    findOne,
    findAll,
    create,
    update,
    remove,
    exists,
    getAllByTipo,
    getLibros
};
