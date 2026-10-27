import { sql, getTableName } from "drizzle-orm";
import { db } from "../src/db/client";
import { personasTable } from "../src/modules/persona/persona.schema";
import {
    usersTable,
    coleccionesTable,
    depositosTable,
    depositoLibrosTable,
    movimientosTable,
    movimientosLibrosTable,
    clientesTable,
    librosTable,
    libroClienteTable,
    librosPersonasTable,
    precioLibroClienteTable,
    precioLibrosTable,
    ventasTable,
    mediosPagoTable,
    rolesTable,
    liquidacionLineasTable,
    liquidacionPagosTable,
    liquidacionVentasTable,
    liquidacionPersonasTable,
    liquidacionesTable,
    anticiposTable,
    integrationsTable,
    mercadoPagoTable,
    shippingConfigTable,
    ordersTable,
    orderItemsTable,
    orderHistoryTable,
    reservationsTable,
    paymentsTable,
    webhookEventsTable,
    shipmentsTable,
    shipmentEventsTable
} from "../src/db/schema";

const TABLAS_SEEDEADAS = [
    // Tienda (ver specs/016): hijas antes que `pedidos` para que el truncate
    // explícito no dependa sólo del cascade de `users`.
    reservationsTable,
    shipmentsTable,
    shipmentEventsTable,
    paymentsTable,
    webhookEventsTable,
    orderHistoryTable,
    orderItemsTable,
    ordersTable,
    shippingConfigTable,
    mercadoPagoTable,
    integrationsTable,
    liquidacionLineasTable,
    liquidacionPagosTable,
    liquidacionVentasTable,
    liquidacionPersonasTable,
    liquidacionesTable,
    anticiposTable,
    movimientosLibrosTable,
    movimientosTable,
    depositoLibrosTable,
    depositosTable,
    ventasTable,
    mediosPagoTable,
    rolesTable,
    precioLibroClienteTable,
    libroClienteTable,
    librosPersonasTable,
    precioLibrosTable,
    librosTable,
    coleccionesTable,
    clientesTable,
    personasTable,
    usersTable
];

// `TRUNCATE ... CASCADE` en vez de borrar tabla por tabla en orden de FKs:
// Postgres resuelve las dependencias solo y de paso reinicia los
// `generatedAlwaysAsIdentity`, así que un re-run del seeder siempre arranca
// de ids limpios.
export async function resetSeedData(): Promise<void> {
    const nombresTablas = TABLAS_SEEDEADAS.map((tabla) => sql.identifier(getTableName(tabla)));

    await db.execute(sql`truncate table ${sql.join(nombresTablas, sql.raw(", "))} restart identity cascade`);
}
