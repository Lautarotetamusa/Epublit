import { eq } from "drizzle-orm";
import { Database } from "../../../db/client";
import { shippingConfigTable } from "./shippingConfig.schema";

export type ShippingConfigRepositoryDeps = {
    db: Database;
};

export type ShippingConfigRow = typeof shippingConfigTable.$inferSelect;
export type ShippingConfigWrite = Omit<ShippingConfigRow, "id" | "creada_en" | "actualizada_en">;

export function createShippingConfigRepository({ db }: ShippingConfigRepositoryDeps) {
    const findByUser = async (userId: number): Promise<ShippingConfigRow | null> => {
        const [row] = await db
            .select()
            .from(shippingConfigTable)
            .where(eq(shippingConfigTable.user, userId))
            .limit(1);

        return row ?? null;
    };

    const upsert = async (values: ShippingConfigWrite): Promise<ShippingConfigRow> => {
        const [row] = await db
            .insert(shippingConfigTable)
            .values(values)
            .onConflictDoUpdate({
                target: shippingConfigTable.user,
                set: {
                    micorreo_usuario: values.micorreo_usuario,
                    micorreo_credencial_cifrada: values.micorreo_credencial_cifrada,
                    micorreo_customer_id: values.micorreo_customer_id,
                    paqar_agreement: values.paqar_agreement,
                    paqar_api_key_cifrada: values.paqar_api_key_cifrada,
                    paqar_seller_id: values.paqar_seller_id,
                    peso_promedio_kg: values.peso_promedio_kg,
                    origen_calle: values.origen_calle,
                    origen_numero: values.origen_numero,
                    origen_piso: values.origen_piso,
                    origen_depto: values.origen_depto,
                    origen_localidad: values.origen_localidad,
                    origen_provincia: values.origen_provincia,
                    origen_codigo_postal: values.origen_codigo_postal,
                    caja_alto_cm: values.caja_alto_cm,
                    caja_ancho_cm: values.caja_ancho_cm,
                    caja_largo_cm: values.caja_largo_cm,
                    formato_etiqueta: values.formato_etiqueta,
                    retiro_activo: values.retiro_activo,
                    retiro_direccion: values.retiro_direccion,
                    retiro_horario: values.retiro_horario,
                    actualizada_en: new Date()
                }
            })
            .returning();

        return row;
    };

    return { findByUser, upsert };
}

export type ShippingConfigRepository = ReturnType<typeof createShippingConfigRepository>;
