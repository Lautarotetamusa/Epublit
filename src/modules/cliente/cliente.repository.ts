import { and, eq, isNull } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { Database } from "../../db/client";
import { clientesTable } from "./cliente.schema";
import { clienteFilterMap } from "./cliente.filter";
import { TipoCliente, tipoCliente } from "./cliente.validator";

export type ClienteRepositoryDeps = {
    db: Database;
};

export function createClienteRepository({ db }: ClienteRepositoryDeps) {
    const builder = new ServiceBuilder(db, clientesTable, clienteFilterMap);

    const findOne = builder.findOne();
    const insert = builder.create();
    const update = builder.update();
    const remove = builder.delete();

    // Ordenado por nombre: mismo `ORDER BY nombre ASC` del `Cliente.getAll` actual.
    const selectOrderedByNombre = () => db.select().from(clientesTable).orderBy(clientesTable.nombre).$dynamic();
    const findAllRaw = builder.findAll(selectOrderedByNombre, false);
    const findAll = async (userId: number, tipo?: TipoCliente) => {
        return findAllRaw({ user: userId, ...(tipo ? { tipo } : {}) });
    };

    const existsByCuit = async (cuit: string, userId: number): Promise<boolean> => {
        const rows = await db
            .select({ id: clientesTable.id })
            .from(clientesTable)
            .where(
                and(
                    eq(clientesTable.cuit, cuit),
                    eq(clientesTable.user, userId),
                    eq(clientesTable.tipo, tipoCliente.inscripto),
                    isNull(clientesTable.deletedAt)
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
        findAll,
        existsByCuit
    };
}

export type ClienteRepository = ReturnType<typeof createClienteRepository>;
