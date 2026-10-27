import { and, eq } from "drizzle-orm";
import { Database } from "../../../db/client";
import { shippingConfigTable } from "../shipping/shippingConfig.schema";
import { mercadoPagoTable } from "../payment/mercadopago.schema";

export type CatalogRepositoryDeps = {
    db: Database;
};

export function createCatalogRepository({ db }: CatalogRepositoryDeps) {
    const getConfiguration = async (userId: number) => {
        const [envio, mercadopago] = await Promise.all([
            db.select().from(shippingConfigTable).where(eq(shippingConfigTable.user, userId)).limit(1),
            db
                .select({ estado: mercadoPagoTable.estado })
                .from(mercadoPagoTable)
                .where(and(eq(mercadoPagoTable.user, userId), eq(mercadoPagoTable.estado, "conectado")))
                .limit(1)
        ]);

        return {
            envio: envio[0] ?? null,
            mercadoPagoConnected: mercadopago.length > 0
        };
    };

    return {
        getConfiguration
    };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
