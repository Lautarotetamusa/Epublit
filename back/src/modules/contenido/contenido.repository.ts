import { and, asc, count, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { ilikeSinAcentos } from "../../lib/sql/search";
import { usersTable } from "../user/user.schema";
import {
    contenidoBloquesTable,
    contenidoImagenesTable,
    contenidoPaginasTable
} from "./contenido.schema";

export type ContenidoRepositoryDeps = {
    db: Database;
};

type Executor = Database | Tx;

export type PaginaRow = typeof contenidoPaginasTable.$inferSelect;
export type BloqueRow = typeof contenidoBloquesTable.$inferSelect;
export type ImagenRow = typeof contenidoImagenesTable.$inferSelect;
export type PaginaConEditor = { pagina: PaginaRow; actualizadaPor: string };

const columnasPagina = {
    pagina: contenidoPaginasTable,
    actualizadaPor: usersTable.username
};

export function createContenidoRepository({ db }: ContenidoRepositoryDeps) {
    const buscarCondicion = (buscar: string | undefined) => {
        if (buscar === undefined) return undefined;

        return or(
            ilikeSinAcentos(contenidoPaginasTable.titulo, buscar),
            ilikeSinAcentos(contenidoPaginasTable.slug, buscar)
        );
    };

    const findActivePages = async (userId: number, buscar?: string): Promise<PaginaConEditor[]> => {
        const condiciones = [eq(contenidoPaginasTable.user, userId), isNull(contenidoPaginasTable.deleted_at)];
        const busqueda = buscarCondicion(buscar);
        if (busqueda) condiciones.push(busqueda);

        return db
            .select(columnasPagina)
            .from(contenidoPaginasTable)
            .innerJoin(usersTable, eq(usersTable.id, contenidoPaginasTable.actualizada_por))
            .where(and(...condiciones))
            .orderBy(asc(contenidoPaginasTable.orden), asc(contenidoPaginasTable.titulo));
    };

    const findPageById = async (
        id: number,
        userId: number,
        executor: Executor = db
    ): Promise<PaginaConEditor | null> => {
        const [row] = await executor
            .select(columnasPagina)
            .from(contenidoPaginasTable)
            .innerJoin(usersTable, eq(usersTable.id, contenidoPaginasTable.actualizada_por))
            .where(
                and(
                    eq(contenidoPaginasTable.id, id),
                    eq(contenidoPaginasTable.user, userId),
                    isNull(contenidoPaginasTable.deleted_at)
                )
            );

        return row ?? null;
    };

    const findPublishedPageBySlug = async (
        slug: string,
        userId: number
    ): Promise<PaginaConEditor | null> => {
        const [row] = await db
            .select(columnasPagina)
            .from(contenidoPaginasTable)
            .innerJoin(usersTable, eq(usersTable.id, contenidoPaginasTable.actualizada_por))
            .where(
                and(
                    eq(contenidoPaginasTable.slug, slug),
                    eq(contenidoPaginasTable.user, userId),
                    eq(contenidoPaginasTable.estado, "publicada"),
                    isNull(contenidoPaginasTable.deleted_at)
                )
            );

        return row ?? null;
    };

    const slugEnUso = async (
        userId: number,
        slug: string,
        excluirPaginaId?: number,
        executor: Executor = db
    ): Promise<boolean> => {
        const condiciones = [
            eq(contenidoPaginasTable.user, userId),
            eq(contenidoPaginasTable.slug, slug),
            isNull(contenidoPaginasTable.deleted_at)
        ];
        if (excluirPaginaId !== undefined) {
            condiciones.push(ne(contenidoPaginasTable.id, excluirPaginaId));
        }

        const [row] = await executor
            .select({ id: contenidoPaginasTable.id })
            .from(contenidoPaginasTable)
            .where(and(...condiciones))
            .limit(1);

        return row !== undefined;
    };

    const insertPage = async (
        data: typeof contenidoPaginasTable.$inferInsert,
        executor: Executor
    ): Promise<number> => {
        const [row] = await executor
            .insert(contenidoPaginasTable)
            .values(data)
            .returning({ id: contenidoPaginasTable.id });

        return row.id;
    };

    const updatePage = async (
        id: number,
        userId: number,
        data: Partial<typeof contenidoPaginasTable.$inferInsert>,
        executor: Executor
    ): Promise<void> => {
        await executor
            .update(contenidoPaginasTable)
            .set(data)
            .where(
                and(
                    eq(contenidoPaginasTable.id, id),
                    eq(contenidoPaginasTable.user, userId),
                    isNull(contenidoPaginasTable.deleted_at)
                )
            );
    };

    const setEstado = async (
        id: number,
        userId: number,
        estado: "borrador" | "publicada"
    ): Promise<void> => {
        await db
            .update(contenidoPaginasTable)
            .set({ estado })
            .where(
                and(
                    eq(contenidoPaginasTable.id, id),
                    eq(contenidoPaginasTable.user, userId),
                    isNull(contenidoPaginasTable.deleted_at)
                )
            );
    };

    const softDeletePage = async (id: number, userId: number): Promise<boolean> => {
        const rows = await db
            .update(contenidoPaginasTable)
            .set({ deleted_at: new Date(), slug: null })
            .where(
                and(
                    eq(contenidoPaginasTable.id, id),
                    eq(contenidoPaginasTable.user, userId),
                    isNull(contenidoPaginasTable.deleted_at)
                )
            )
            .returning({ id: contenidoPaginasTable.id });

        return rows.length > 0;
    };

    const findBlocksByPage = async (
        paginaId: number,
        userId: number,
        executor: Executor = db
    ): Promise<BloqueRow[]> =>
        executor
            .select()
            .from(contenidoBloquesTable)
            .where(
                and(
                    eq(contenidoBloquesTable.pagina_id, paginaId),
                    eq(contenidoBloquesTable.user, userId)
                )
            )
            .orderBy(asc(contenidoBloquesTable.posicion));

    const countBlocksByPage = async (userId: number): Promise<Map<number, number>> => {
        const rows = await db
            .select({ pagina_id: contenidoBloquesTable.pagina_id, cantidad: count() })
            .from(contenidoBloquesTable)
            .where(eq(contenidoBloquesTable.user, userId))
            .groupBy(contenidoBloquesTable.pagina_id);

        return new Map(rows.map((row) => [row.pagina_id, Number(row.cantidad)]));
    };

    const offsetBlockPositions = async (
        paginaId: number,
        userId: number,
        offset: number,
        executor: Executor
    ): Promise<void> => {
        await executor
            .update(contenidoBloquesTable)
            .set({ posicion: sql`${contenidoBloquesTable.posicion} + ${offset}` })
            .where(
                and(
                    eq(contenidoBloquesTable.pagina_id, paginaId),
                    eq(contenidoBloquesTable.user, userId)
                )
            );
    };

    const insertBlock = async (
        data: typeof contenidoBloquesTable.$inferInsert,
        executor: Executor
    ): Promise<void> => {
        await executor.insert(contenidoBloquesTable).values(data);
    };

    const updateBlock = async (
        id: number,
        paginaId: number,
        userId: number,
        data: Pick<typeof contenidoBloquesTable.$inferInsert, "tipo" | "posicion" | "contenido">,
        executor: Executor
    ): Promise<boolean> => {
        const rows = await executor
            .update(contenidoBloquesTable)
            .set(data)
            .where(
                and(
                    eq(contenidoBloquesTable.id, id),
                    eq(contenidoBloquesTable.pagina_id, paginaId),
                    eq(contenidoBloquesTable.user, userId)
                )
            )
            .returning({ id: contenidoBloquesTable.id });

        return rows.length > 0;
    };

    const deleteBlocks = async (ids: number[], userId: number, executor: Executor): Promise<void> => {
        if (ids.length === 0) return;

        await executor
            .delete(contenidoBloquesTable)
            .where(
                and(
                    inArray(contenidoBloquesTable.id, ids),
                    eq(contenidoBloquesTable.user, userId)
                )
            );
    };

    const insertImagen = async (
        data: typeof contenidoImagenesTable.$inferInsert
    ): Promise<ImagenRow> => {
        const [row] = await db.insert(contenidoImagenesTable).values(data).returning();
        return row;
    };

    const findImagenById = async (id: number, userId: number): Promise<ImagenRow | null> => {
        const [row] = await db
            .select()
            .from(contenidoImagenesTable)
            .where(
                and(
                    eq(contenidoImagenesTable.id, id),
                    eq(contenidoImagenesTable.user, userId)
                )
            );

        return row ?? null;
    };

    const findImagenesByIds = async (userId: number, ids: number[]): Promise<ImagenRow[]> => {
        if (ids.length === 0) return [];

        return db
            .select()
            .from(contenidoImagenesTable)
            .where(
                and(
                    eq(contenidoImagenesTable.user, userId),
                    inArray(contenidoImagenesTable.id, ids)
                )
            );
    };

    // La portada de una página vigente bloquea el borrado en el service; si
    // sólo la referencia una página dada de baja, se suelta esa referencia
    // antes de borrar la imagen (la baja no se restaura en Fase 1).
    const clearPortadaFromDeletedPages = async (userId: number, id: number): Promise<void> => {
        await db
            .update(contenidoPaginasTable)
            .set({
                portada_imagen_id: null,
                portada_texto_alternativo: null,
                portada_epigrafe: null
            })
            .where(
                and(
                    eq(contenidoPaginasTable.user, userId),
                    eq(contenidoPaginasTable.portada_imagen_id, id),
                    isNotNull(contenidoPaginasTable.deleted_at)
                )
            );
    };

    const deleteImagen = async (id: number, userId: number): Promise<void> => {
        await db
            .delete(contenidoImagenesTable)
            .where(
                and(
                    eq(contenidoImagenesTable.id, id),
                    eq(contenidoImagenesTable.user, userId)
                )
            );
    };

    const findActiveImageReferences = async (
        userId: number
    ): Promise<{ portadaImagenIds: number[]; bloques: unknown[] }> => {
        const paginas = await db
            .select({ portada_imagen_id: contenidoPaginasTable.portada_imagen_id })
            .from(contenidoPaginasTable)
            .where(
                and(
                    eq(contenidoPaginasTable.user, userId),
                    isNull(contenidoPaginasTable.deleted_at)
                )
            );

        const bloques = await db
            .select({ contenido: contenidoBloquesTable.contenido })
            .from(contenidoBloquesTable)
            .innerJoin(
                contenidoPaginasTable,
                and(
                    eq(contenidoBloquesTable.pagina_id, contenidoPaginasTable.id),
                    eq(contenidoBloquesTable.user, contenidoPaginasTable.user)
                )
            )
            .where(
                and(
                    eq(contenidoPaginasTable.user, userId),
                    isNull(contenidoPaginasTable.deleted_at)
                )
            );

        return {
            portadaImagenIds: paginas
                .map((pagina) => pagina.portada_imagen_id)
                .filter((id): id is number => id !== null),
            bloques: bloques.map((bloque) => bloque.contenido)
        };
    };

    return {
        findActivePages,
        findPageById,
        findPublishedPageBySlug,
        slugEnUso,
        insertPage,
        updatePage,
        setEstado,
        softDeletePage,
        findBlocksByPage,
        countBlocksByPage,
        offsetBlockPositions,
        insertBlock,
        updateBlock,
        deleteBlocks,
        insertImagen,
        findImagenById,
        findImagenesByIds,
        clearPortadaFromDeletedPages,
        deleteImagen,
        findActiveImageReferences
    };
}

export type ContenidoRepository = ReturnType<typeof createContenidoRepository>;
