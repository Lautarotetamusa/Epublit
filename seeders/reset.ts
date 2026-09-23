import { sql, getTableName } from "drizzle-orm";
import { db } from "../src/pgDb";
import {
    usersTable,
    personasTable,
    clientesTable,
    librosTable,
    libroClienteTable,
    librosPersonasTable,
    transaccionesTable,
    librosTransaccionesTable,
    precioLibroClienteTable,
    precioLibrosTable,
    ventasTable
} from "../src/schemas";

const TABLAS_SEEDEADAS = [
    ventasTable,
    librosTransaccionesTable,
    transaccionesTable,
    precioLibroClienteTable,
    libroClienteTable,
    librosPersonasTable,
    precioLibrosTable,
    librosTable,
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
