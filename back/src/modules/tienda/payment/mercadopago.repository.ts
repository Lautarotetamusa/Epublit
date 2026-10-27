import { and, eq } from "drizzle-orm";
import { Database } from "../../../db/client";
import { mercadoPagoTable } from "./mercadopago.schema";

export type MercadoPagoRepositoryDeps = { db: Database };
export type MercadoPagoRow = typeof mercadoPagoTable.$inferSelect;

export type MercadoPagoTokenUpdate = {
    accessTokenCifrado: string;
    refreshTokenCifrado: string | null;
    vencimiento: Date;
};

export function createMercadoPagoRepository({ db }: MercadoPagoRepositoryDeps) {
    const findByUser = async (userId: number): Promise<MercadoPagoRow | null> => {
        const [row] = await db
            .select()
            .from(mercadoPagoTable)
            .where(eq(mercadoPagoTable.user, userId))
            .limit(1);
        return row ?? null;
    };

    const findConnectedByUser = async (userId: number): Promise<MercadoPagoRow | null> => {
        const [row] = await db
            .select()
            .from(mercadoPagoTable)
            .where(and(eq(mercadoPagoTable.user, userId), eq(mercadoPagoTable.estado, "conectado")))
            .limit(1);
        return row ?? null;
    };

    const findConnectedByMpUserId = async (mpUserId: string): Promise<MercadoPagoRow | null> => {
        const [row] = await db
            .select()
            .from(mercadoPagoTable)
            .where(
                and(
                    eq(mercadoPagoTable.mp_user_id, mpUserId),
                    eq(mercadoPagoTable.estado, "conectado")
                )
            )
            .limit(1);
        return row ?? null;
    };

    const isMpUserConnectedToAnotherAccount = async (mpUserId: string, userId: number) => {
        const [row] = await db
            .select({ id: mercadoPagoTable.id })
            .from(mercadoPagoTable)
            .where(
                and(
                    eq(mercadoPagoTable.mp_user_id, mpUserId),
                    eq(mercadoPagoTable.estado, "conectado")
                )
            )
            .limit(1);

        if (!row) return false;
        const actual = await findConnectedByUser(userId);
        return !actual || actual.mp_user_id !== mpUserId;
    };

    const saveConnection = async (values: {
        user: number;
        mpUserId: string;
        alias: string | null;
        email: string | null;
        aplicacionId: string | null;
        accessTokenCifrado: string;
        refreshTokenCifrado: string | null;
        vencimiento: Date;
    }): Promise<MercadoPagoRow> => {
        const [row] = await db
            .insert(mercadoPagoTable)
            .values({
                user: values.user,
                mp_user_id: values.mpUserId,
                alias: values.alias,
                email: values.email,
                aplicacion_id: values.aplicacionId,
                access_token_cifrado: values.accessTokenCifrado,
                refresh_token_cifrado: values.refreshTokenCifrado,
                vencimiento: values.vencimiento,
                estado: "conectado"
            })
            .onConflictDoUpdate({
                target: mercadoPagoTable.user,
                set: {
                    mp_user_id: values.mpUserId,
                    alias: values.alias,
                    email: values.email,
                    aplicacion_id: values.aplicacionId,
                    access_token_cifrado: values.accessTokenCifrado,
                    refresh_token_cifrado: values.refreshTokenCifrado,
                    vencimiento: values.vencimiento,
                    estado: "conectado",
                    conectado_en: new Date(),
                    actualizado_en: new Date()
                }
            })
            .returning();

        return row;
    };

    const updateTokens = async (
        userId: number,
        tokens: MercadoPagoTokenUpdate
    ): Promise<MercadoPagoRow> => {
        const [row] = await db
            .update(mercadoPagoTable)
            .set({
                access_token_cifrado: tokens.accessTokenCifrado,
                refresh_token_cifrado: tokens.refreshTokenCifrado,
                vencimiento: tokens.vencimiento,
                actualizado_en: new Date()
            })
            .where(eq(mercadoPagoTable.user, userId))
            .returning();

        return row;
    };

    const deleteByUser = async (userId: number): Promise<void> => {
        await db.delete(mercadoPagoTable).where(eq(mercadoPagoTable.user, userId));
    };

    return {
        findByUser,
        findConnectedByUser,
        findConnectedByMpUserId,
        isMpUserConnectedToAnotherAccount,
        saveConnection,
        updateTokens,
        deleteByUser
    };
}

export type MercadoPagoRepository = ReturnType<typeof createMercadoPagoRepository>;
