import { and, desc, eq, isNull } from "drizzle-orm";
import { Database } from "../../../db/client";
import { librosTable } from "../../libro/libro.schema";
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

    // Los “novedades” son los últimos libros dados de alta: `id_libro` es una
    // identity y crece en el orden de creación. Se calcula acá, del lado del
    // servidor, para no exponer el id interno ni depender de la fecha de edición.
    const findUltimosIds = async (userId: number, cantidad: number): Promise<number[]> => {
        const filas = await db
            .select({ id: librosTable.id_libro })
            .from(librosTable)
            .where(and(eq(librosTable.user, userId), isNull(librosTable.deletedAt)))
            .orderBy(desc(librosTable.id_libro))
            .limit(cantidad);

        return filas.map((fila) => fila.id);
    };

    return {
        getConfiguration,
        findUltimosIds
    };
}

export type CatalogRepository = ReturnType<typeof createCatalogRepository>;
