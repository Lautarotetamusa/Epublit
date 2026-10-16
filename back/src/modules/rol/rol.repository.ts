import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { Database, Tx } from "../../db/client";
import { librosPersonasTable } from "../libro/libroPersona.schema";
import { librosTable } from "../libro/libro.schema";
import { personasTable } from "../persona/persona.schema";
import { rolesTable } from "./rol.schema";
import { rolFilterMap } from "./rol.filter";

export type RolRepositoryDeps = {
    db: Database;
};

// Los dos roles con los que arranca toda cuenta nueva (ver plan, "Roles por
// cuenta"). La migración de las cuentas existentes repite esta misma lista en
// SQL: no puede importarla.
export const ROLES_POR_DEFECTO = ["autor", "ilustrador"] as const;

export function createRolRepository({ db }: RolRepositoryDeps) {
    const builder = new ServiceBuilder(db, rolesTable, rolFilterMap);

    // `findOne`/`update`/`remove` de bradb excluyen las filas con `deleted_at`
    // (soft delete) y arman el WHERE con la PK completa, así que dan 404 tanto
    // para un id ajeno como para uno dado de baja.
    const findOne = builder.findOne();
    const insert = builder.create();
    const update = builder.update();
    const remove = builder.delete();

    const insertDefaults = async (userId: number, tx?: Tx) => {
        return (tx ?? db)
            .insert(rolesTable)
            .values(ROLES_POR_DEFECTO.map((nombre) => ({ nombre, user: userId })))
            .returning();
    };

    const findActivos = async (userId: number) => {
        return db
            .select({ id: rolesTable.id, nombre: rolesTable.nombre })
            .from(rolesTable)
            .where(and(eq(rolesTable.user, userId), isNull(rolesTable.deletedAt)))
            .orderBy(asc(rolesTable.id));
    };

    // Nombre repetido entre roles *activos*, comparando sin distinguir
    // mayúsculas (`Autor` choca con `autor`): el nombre de uno dado de baja no
    // bloquea el alta. `excludeId` deja fuera al propio rol al editar.
    const findByNombreActivo = async (nombre: string, userId: number, excludeId?: number) => {
        const condiciones = [
            eq(rolesTable.user, userId),
            sql`lower(${rolesTable.nombre}) = lower(${nombre})`,
            isNull(rolesTable.deletedAt)
        ];
        if (excludeId !== undefined) condiciones.push(ne(rolesTable.id, excludeId));

        const rows = await db.select({ id: rolesTable.id }).from(rolesTable).where(and(...condiciones)).limit(1);
        return rows[0] ?? null;
    };

    // Incluye los dados de baja: el filtro de personas por rol debe poder
    // encontrar el historial aunque el rol ya no esté activo.
    const existsEnCuenta = async (id: number, userId: number) => {
        const rows = await db
            .select({ id: rolesTable.id })
            .from(rolesTable)
            .where(and(eq(rolesTable.id, id), eq(rolesTable.user, userId)))
            .limit(1);

        return rows.length > 0;
    };

    // `true` sólo si algún libro activo con una persona activa usa el rol: un
    // libro o una persona dados de baja no bloquean la baja del rol (ver plan,
    // tarea 7).
    const enUso = async (id: number, userId: number) => {
        const rows = await db
            .select({ id_rol: librosPersonasTable.id_rol })
            .from(librosPersonasTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, librosPersonasTable.id_libro), eq(librosTable.user, userId))
            )
            .innerJoin(personasTable, and(eq(personasTable.id, librosPersonasTable.id_persona), eq(personasTable.user, userId)))
            .where(
                and(
                    eq(librosPersonasTable.id_rol, id),
                    isNull(librosTable.deletedAt),
                    isNull(personasTable.deletedAt)
                )
            )
            .limit(1);

        return rows.length > 0;
    };

    return {
        findOne,
        insert,
        update,
        remove,
        insertDefaults,
        findActivos,
        findByNombreActivo,
        existsEnCuenta,
        enUso
    };
}

export type RolRepository = ReturnType<typeof createRolRepository>;
