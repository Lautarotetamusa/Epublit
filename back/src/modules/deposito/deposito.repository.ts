import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { ServiceBuilder, NotFound } from "bradb";
import { Database, Tx } from "../../db/client";
import { depositosTable } from "./deposito.schema";
import { depositoLibrosTable } from "./depositoLibros.schema";
import { librosTable } from "../libro/libro.schema";
import { depositoFilterMap } from "./deposito.filter";

export type DepositoRepositoryDeps = {
    db: Database;
};

// Resumen de lo que hay en un depósito: libros distintos con cantidad > 0 y
// suma de esas cantidades.
export type DepositoResumen = {
    titulos: number;
    ejemplares: number;
};

export function createDepositoRepository({ db }: DepositoRepositoryDeps) {
    const builder = new ServiceBuilder(db, depositosTable, depositoFilterMap);

    const findOne = builder.findOne();
    const insert = builder.create();
    const update = builder.update();
    // Baja lógica (bradb detecta `deleted_at`): el nombre sigue disponible
    // para los movimientos históricos que mencionan el depósito.
    const remove = builder.delete();
    const findAll = builder.findAll(false);

    const findPrincipal = async (userId: number) => {
        const rows = await db
            .select()
            .from(depositosTable)
            .where(
                and(
                    eq(depositosTable.user, userId),
                    eq(depositosTable.principal, true),
                    isNull(depositosTable.deletedAt)
                )
            );

        if (rows.length === 0) throw new NotFound(`El usuario ${userId} no tiene depósito principal`);
        return rows[0];
    };

    const resumenQuery = () =>
        db
            .select({
                deposito_id: depositoLibrosTable.deposito_id,
                titulos: sql<number>`count(*) filter (where ${depositoLibrosTable.cantidad} > 0)`.mapWith(Number),
                ejemplares: sql<number>`coalesce(sum(${depositoLibrosTable.cantidad}), 0)`.mapWith(Number)
            })
            .from(depositoLibrosTable)
            .$dynamic();

    // Una sola query para todo el listado (group by) en vez de contar depósito
    // por depósito: evita N+1 en `GET /deposito/`.
    const getResumenes = async (userId: number): Promise<Map<number, DepositoResumen>> => {
        const rows = await resumenQuery()
            .where(eq(depositoLibrosTable.user, userId))
            .groupBy(depositoLibrosTable.deposito_id);

        return new Map(rows.map((row) => [row.deposito_id, { titulos: row.titulos, ejemplares: row.ejemplares }]));
    };

    const getResumen = async (depositoId: number, userId: number): Promise<DepositoResumen> => {
        const rows = await resumenQuery()
            .where(and(eq(depositoLibrosTable.user, userId), eq(depositoLibrosTable.deposito_id, depositoId)))
            .groupBy(depositoLibrosTable.deposito_id);

        return rows[0] ?? { titulos: 0, ejemplares: 0 };
    };

    // Sólo libros con cantidad mayor a 0: un depósito sin stock no lista ninguno.
    const getLibros = async (depositoId: number, userId: number) => {
        return db
            .select({
                isbn: librosTable.isbn,
                titulo: librosTable.titulo,
                cantidad: depositoLibrosTable.cantidad
            })
            .from(depositoLibrosTable)
            .innerJoin(
                librosTable,
                and(eq(librosTable.id_libro, depositoLibrosTable.id_libro), eq(librosTable.user, depositoLibrosTable.user))
            )
            .where(
                and(
                    eq(depositoLibrosTable.deposito_id, depositoId),
                    eq(depositoLibrosTable.user, userId),
                    gt(depositoLibrosTable.cantidad, 0),
                    isNull(librosTable.deletedAt)
                )
            )
            .orderBy(asc(librosTable.titulo));
    };

    // Desglose de un libro entre los depósitos (vigentes) donde tiene cantidad
    // mayor a 0, con el principal primero.
    const getDesgloseLibro = async (idLibro: number, userId: number) => {
        return db
            .select({
                id: depositosTable.id,
                nombre: depositosTable.nombre,
                cantidad: depositoLibrosTable.cantidad,
                principal: depositosTable.principal
            })
            .from(depositoLibrosTable)
            .innerJoin(
                depositosTable,
                and(eq(depositosTable.id, depositoLibrosTable.deposito_id), eq(depositosTable.user, depositoLibrosTable.user))
            )
            .where(
                and(
                    eq(depositoLibrosTable.id_libro, idLibro),
                    eq(depositoLibrosTable.user, userId),
                    gt(depositoLibrosTable.cantidad, 0),
                    isNull(depositosTable.deletedAt)
                )
            )
            .orderBy(desc(depositosTable.principal), asc(depositosTable.nombre));
    };

    const getCantidades = async (depositoId: number, userId: number, idLibros: number[]) => {
        if (idLibros.length === 0) return [];

        return db
            .select({ id_libro: depositoLibrosTable.id_libro, cantidad: depositoLibrosTable.cantidad })
            .from(depositoLibrosTable)
            .where(
                and(
                    eq(depositoLibrosTable.deposito_id, depositoId),
                    eq(depositoLibrosTable.user, userId),
                    inArray(depositoLibrosTable.id_libro, idLibros)
                )
            );
    };

    // Upsert del delta en un único statement: cubre el alta y los tres casos
    // de movimiento (ingreso suma, baja resta, transferencia resta y suma).
    const moveStock = async (depositoId: number, idLibro: number, userId: number, delta: number, tx?: Tx): Promise<void> => {
        await (tx ?? db)
            .insert(depositoLibrosTable)
            .values({ deposito_id: depositoId, id_libro: idLibro, user: userId, cantidad: delta })
            .onConflictDoUpdate({
                target: [depositoLibrosTable.deposito_id, depositoLibrosTable.id_libro],
                set: { cantidad: sql`${depositoLibrosTable.cantidad} + ${delta}` }
            });
    };

    return {
        findOne,
        insert,
        update,
        remove,
        findAll,
        findPrincipal,
        getResumenes,
        getResumen,
        getLibros,
        getDesgloseLibro,
        getCantidades,
        moveStock
    };
}

export type DepositoRepository = ReturnType<typeof createDepositoRepository>;
