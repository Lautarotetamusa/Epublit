import { resetSeedData } from "./reset";
import { seedUsers, PASSWORD_SEED } from "./users.seeder";
import { seedPersonas } from "./personas.seeder";
import { seedClientes } from "./clientes.seeder";
import { seedLibros } from "./libros.seeder";
import { seedLibrosPersonas } from "./librosPersonas.seeder";
import { seedLibroCliente } from "./libroCliente.seeder";
import { seedOperaciones } from "./operaciones.seeder";

// Orden fijo por dependencia de FKs: cada seeder recibe lo que ya generaron
// los anteriores (DI por parámetros, no un estado global compartido).
async function main(): Promise<void> {
    await resetSeedData();

    const users = await seedUsers();
    const personas = await seedPersonas(users);
    const clientes = await seedClientes(users);
    const libros = await seedLibros(users);

    await seedLibrosPersonas(users, libros, personas);
    await seedLibroCliente(users, libros, clientes);
    await seedOperaciones(users, libros, clientes);

    console.log(`Seed listo: ${users.length} usuarios, password de todos: "${PASSWORD_SEED}"`);
    for (const user of users) {
        console.log(`  - ${user.username} (cuit ${user.cuit})`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Error corriendo los seeders:", err);
        process.exit(1);
    });
