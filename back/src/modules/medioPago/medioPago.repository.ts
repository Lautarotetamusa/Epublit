import { and, eq, isNull, ne } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { Database, Tx } from "../../db/client";
import { ordenAlfabetico } from "../../lib/sql/search";
import { mediosPagoTable } from "./medioPago.schema";
import { medioPagoFilterMap } from "./medioPago.filter";

export type MedioPagoRepositoryDeps = {
    db: Database;
};

// Los cinco medios con los que arranca toda cuenta nueva (ver plan,
// "Medios de pago por defecto"), todos con comisión 0. La migración de las
// cuentas existentes repite esta misma lista en SQL: no puede importarla.
export const MEDIOS_PAGO_POR_DEFECTO = ["efectivo", "debito", "credito", "mercadopago", "transferencia"] as const;

export function createMedioPagoRepository({ db }: MedioPagoRepositoryDeps) {
    const builder = new ServiceBuilder(db, mediosPagoTable, medioPagoFilterMap);

    // `findOne`/`update`/`remove` de bradb excluyen las filas con `deleted_at`
    // (soft delete) y arman el WHERE con la PK completa, así que dan 404 tanto
    // para un id ajeno como para uno dado de baja.
    const findOne = builder.findOne();
    const insert = builder.create();
    const update = builder.update();
    const remove = builder.delete();

    const insertDefaults = async (userId: number, tx?: Tx) => {
        return (tx ?? db)
            .insert(mediosPagoTable)
            .values(MEDIOS_PAGO_POR_DEFECTO.map((nombre) => ({ nombre, comision: 0, user: userId })))
            .returning();
    };

    const findActivos = async (userId: number) => {
        return db
            .select({
                id: mediosPagoTable.id,
                nombre: mediosPagoTable.nombre,
                comision: mediosPagoTable.comision
            })
            .from(mediosPagoTable)
            .where(and(eq(mediosPagoTable.user, userId), isNull(mediosPagoTable.deletedAt)))
            .orderBy(ordenAlfabetico(mediosPagoTable.nombre));
    };

    // Nombre repetido entre medios *activos*: el mismo nombre de uno dado de
    // baja no bloquea el alta. `excludeId` deja fuera al propio medio al editar.
    const findByNombreActivo = async (nombre: string, userId: number, excludeId?: number) => {
        const condiciones = [
            eq(mediosPagoTable.user, userId),
            eq(mediosPagoTable.nombre, nombre),
            isNull(mediosPagoTable.deletedAt)
        ];
        if (excludeId !== undefined) condiciones.push(ne(mediosPagoTable.id, excludeId));

        const rows = await db.select({ id: mediosPagoTable.id }).from(mediosPagoTable).where(and(...condiciones)).limit(1);
        return rows[0] ?? null;
    };

    // Incluye los dados de baja: el filtro de ventas por medio debe poder
    // encontrar el historial aunque el medio ya no esté activo.
    const existsEnCuenta = async (id: number, userId: number) => {
        const rows = await db
            .select({ id: mediosPagoTable.id })
            .from(mediosPagoTable)
            .where(and(eq(mediosPagoTable.id, id), eq(mediosPagoTable.user, userId)))
            .limit(1);

        return rows.length > 0;
    };

    // Borrado físico, sólo para dar de baja una cuenta que nunca se usó (ver
    // specs/026-registro-email): la baja de un día a día es lógica.
    const removeAllOfUser = async (userId: number, tx: Tx) => {
        await tx.delete(mediosPagoTable).where(eq(mediosPagoTable.user, userId));
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
        removeAllOfUser
    };
}

export type MedioPagoRepository = ReturnType<typeof createMedioPagoRepository>;
