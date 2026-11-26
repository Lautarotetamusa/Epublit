import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { Database, Tx } from "../../db/client";
import { ordenAlfabetico } from "../../lib/sql/search";
import { tiposEdicionTable } from "./tipoEdicion.schema";
import { tipoEdicionFilterMap } from "./tipoEdicion.filter";
import { TipoEdicion } from "./tipoEdicion.validator";

export type TipoEdicionRepositoryDeps = {
    db: Database;
};

// Los tipos con los que arranca toda cuenta nueva. La migración de las
// cuentas existentes repite esta misma lista en SQL: no puede importarla.
export const TIPOS_EDICION_POR_DEFECTO = ["Normal", "Pop up", "Cartoné"] as const;

// El nombre que se usa como default al crear un libro cuando no se elige uno.
const NOMBRE_TIPO_POR_DEFECTO = "normal";

export function createTipoEdicionRepository({ db }: TipoEdicionRepositoryDeps) {
    const builder = new ServiceBuilder(db, tiposEdicionTable, tipoEdicionFilterMap);

    // `findOne`/`update`/`remove` de bradb excluyen las filas con `deleted_at`
    // (soft delete) y arman el WHERE con la PK completa, así que dan 404 tanto
    // para un id ajeno como para uno dado de baja.
    const findOne = builder.findOne();
    const insert = builder.create();
    const update = builder.update();
    const remove = builder.delete();

    const insertDefaults = async (userId: number, tx?: Tx) => {
        return (tx ?? db)
            .insert(tiposEdicionTable)
            .values(TIPOS_EDICION_POR_DEFECTO.map((nombre) => ({ nombre, user: userId })))
            .returning();
    };

    const findActivos = async (userId: number): Promise<TipoEdicion[]> =>
        db
            .select({ id: tiposEdicionTable.id, nombre: tiposEdicionTable.nombre })
            .from(tiposEdicionTable)
            .where(and(eq(tiposEdicionTable.user, userId), isNull(tiposEdicionTable.deletedAt)))
            .orderBy(ordenAlfabetico(tiposEdicionTable.nombre));

    // Tipo por defecto de la cuenta: "Normal" si está activo (es el que usaban
    // los libros antes del CRUD) o, si no, el primero alfabético.
    const findDefault = async (userId: number): Promise<TipoEdicion | null> => {
        const activos = await findActivos(userId);

        return activos.find((tipo) => tipo.nombre.toLowerCase() === NOMBRE_TIPO_POR_DEFECTO) ?? activos[0] ?? null;
    };

    // Nombre repetido entre tipos *activos*, comparando sin distinguir
    // mayúsculas: el de uno dado de baja no bloquea el alta. `excludeId` deja
    // fuera al propio tipo al editar.
    const findByNombreActivo = async (nombre: string, userId: number, excludeId?: number) => {
        const condiciones = [
            eq(tiposEdicionTable.user, userId),
            sql`lower(${tiposEdicionTable.nombre}) = lower(${nombre})`,
            isNull(tiposEdicionTable.deletedAt)
        ];
        if (excludeId !== undefined) condiciones.push(ne(tiposEdicionTable.id, excludeId));

        const rows = await db.select({ id: tiposEdicionTable.id }).from(tiposEdicionTable).where(and(...condiciones)).limit(1);
        return rows[0] ?? null;
    };

    // Incluye los dados de baja: el libro puede seguir referenciando un tipo
    // que ya no se ofrece.
    const existsEnCuenta = async (id: number, userId: number) => {
        const rows = await db
            .select({ id: tiposEdicionTable.id })
            .from(tiposEdicionTable)
            .where(and(eq(tiposEdicionTable.id, id), eq(tiposEdicionTable.user, userId)))
            .limit(1);

        return rows.length > 0;
    };

    // Borrado físico, sólo para dar de baja una cuenta que nunca se usó (ver
    // specs/026-registro-email): la baja de un día a día es lógica.
    const removeAllOfUser = async (userId: number, tx: Tx) => {
        await tx.delete(tiposEdicionTable).where(eq(tiposEdicionTable.user, userId));
    };

    return {
        findOne,
        insert,
        update,
        remove,
        insertDefaults,
        findActivos,
        findDefault,
        findByNombreActivo,
        existsEnCuenta,
        removeAllOfUser
    };
}

export type TipoEdicionRepository = ReturnType<typeof createTipoEdicionRepository>;
