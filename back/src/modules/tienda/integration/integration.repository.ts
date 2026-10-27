import { and, desc, eq } from "drizzle-orm";
import { NotFound } from "bradb";
import { Database } from "../../../db/client";
import { integrationsTable } from "./integration.schema";
import { IntegrationCreate, IntegrationUpdate } from "./integration.validator";

export type IntegrationRepositoryDeps = {
    db: Database;
};

export type IntegrationRow = typeof integrationsTable.$inferSelect;

export function createIntegrationRepository({ db }: IntegrationRepositoryDeps) {
    const findByHash = async (keyHash: string): Promise<IntegrationRow | undefined> => {
        const rows = await db
            .select()
            .from(integrationsTable)
            .where(eq(integrationsTable.clave_hash, keyHash))
            .limit(1);

        return rows[0];
    };

    // Para el preflight CORS: el navegador no manda la API key en el OPTIONS,
    // así que se resuelve si el origen pertenece a alguna integración vigente.
    const existsActiveByOrigin = async (origen: string): Promise<boolean> => {
        const rows = await db
            .select({ id: integrationsTable.id })
            .from(integrationsTable)
            .where(
                and(
                    eq(integrationsTable.origen, origen),
                    eq(integrationsTable.activa, true),
                    eq(integrationsTable.revocada, false)
                )
            )
            .limit(1);

        return rows.length > 0;
    };

    const findAll = async (userId: number): Promise<IntegrationRow[]> => {
        return db
            .select()
            .from(integrationsTable)
            .where(eq(integrationsTable.user, userId))
            .orderBy(desc(integrationsTable.creada_en));
    };

    const findOne = async (id: number, userId: number): Promise<IntegrationRow> => {
        const rows = await db
            .select()
            .from(integrationsTable)
            .where(and(eq(integrationsTable.id, id), eq(integrationsTable.user, userId)))
            .limit(1);

        if (rows.length === 0) throw new NotFound(`No existe la integración con id ${id}`);
        return rows[0];
    };

    const insert = async (
        data: IntegrationCreate & { user: number; prefijo: string; keyHash: string }
    ): Promise<IntegrationRow> => {
        const [row] = await db
            .insert(integrationsTable)
            .values({
                user: data.user,
                nombre: data.nombre,
                origen: data.origen,
                prefijo: data.prefijo,
                clave_hash: data.keyHash
            })
            .returning();

        return row;
    };

    const update = async (id: number, userId: number, data: IntegrationUpdate): Promise<IntegrationRow> => {
        const [row] = await db
            .update(integrationsTable)
            .set({ activa: data.activa, actualizada_en: new Date() })
            .where(and(eq(integrationsTable.id, id), eq(integrationsTable.user, userId)))
            .returning();

        if (!row) throw new NotFound(`No existe la integración con id ${id}`);
        return row;
    };

    const revoke = async (id: number, userId: number): Promise<IntegrationRow> => {
        const [row] = await db
            .update(integrationsTable)
            .set({
                activa: false,
                revocada: true,
                revocada_en: new Date(),
                actualizada_en: new Date()
            })
            .where(and(eq(integrationsTable.id, id), eq(integrationsTable.user, userId)))
            .returning();

        if (!row) throw new NotFound(`No existe la integración con id ${id}`);
        return row;
    };

    const touchLastUsed = async (id: number, userId: number): Promise<void> => {
        await db
            .update(integrationsTable)
            .set({ ultimo_uso: new Date() })
            .where(and(eq(integrationsTable.id, id), eq(integrationsTable.user, userId)));
    };

    return {
        findByHash,
        existsActiveByOrigin,
        findAll,
        findOne,
        insert,
        update,
        revoke,
        touchLastUsed
    };
}

export type IntegrationRepository = ReturnType<typeof createIntegrationRepository>;
