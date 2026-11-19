import { and, eq, isNull } from "drizzle-orm";
import { Database, Tx } from "../../db/client";
import { tokensCuentaTable } from "./user.schema";

export type TipoTokenCuenta = (typeof tokensCuentaTable.$inferSelect)["tipo"];
export type TokenCuenta = typeof tokensCuentaTable.$inferSelect;
export type TokenCuentaInsert = Omit<typeof tokensCuentaTable.$inferInsert, "id" | "usado_en">;

export type TokenCuentaRepositoryDeps = {
    db: Database;
};

export function createTokenCuentaRepository({ db }: TokenCuentaRepositoryDeps) {
    const insert = async (data: TokenCuentaInsert): Promise<void> => {
        await db.insert(tokensCuentaTable).values(data);
    };

    const findByHash = async (tipo: TipoTokenCuenta, hash: string): Promise<TokenCuenta | undefined> => {
        const [token] = await db
            .select()
            .from(tokensCuentaTable)
            .where(and(eq(tokensCuentaTable.tipo, tipo), eq(tokensCuentaTable.hash, hash)));
        return token;
    };

    const markUsed = async (id: number, usadoEn: Date, tx?: Tx): Promise<void> => {
        await (tx ?? db).update(tokensCuentaTable).set({ usado_en: usadoEn }).where(eq(tokensCuentaTable.id, id));
    };

    const markAllUnusedAsUsed = async (userId: number, tipo: TipoTokenCuenta, usadoEn: Date, tx?: Tx): Promise<void> => {
        await (tx ?? db)
            .update(tokensCuentaTable)
            .set({ usado_en: usadoEn })
            .where(and(eq(tokensCuentaTable.user, userId), eq(tokensCuentaTable.tipo, tipo), isNull(tokensCuentaTable.usado_en)));
    };

    return { insert, findByHash, markUsed, markAllUnusedAsUsed };
}

export type TokenCuentaRepository = ReturnType<typeof createTokenCuentaRepository>;
