import { db } from "../src/db/client";
import { createMockAfipService } from "../src/lib/afip/Afip.mock";
import { createMockComprobanteService } from "../src/lib/comprobantes/comprobante.mock";
import { createLocalStorage } from "../src/lib/storage";
import { env } from "../src/env";
import { createPersonaModule } from "../src/modules/persona";
import { createLibroModule } from "../src/modules/libro";
import { createUserModule } from "../src/modules/user";
import { createClienteModule } from "../src/modules/cliente";
import { createTransaccionModule } from "../src/modules/transaccion";
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

    // Mock, no el real: un seeder de desarrollo no puede depender de una
    // llamada de red real a AFIP (ver seeders/clientes.seeder.ts). Idem
    // `comprobanteService`: `seedOperaciones` inserta directo por
    // repository, nunca dispara `generarComprobante`, pero el módulo
    // transaccion igual lo necesita para armarse.
    const afipService = createMockAfipService();
    const comprobanteService = createMockComprobanteService();
    const storage = createLocalStorage({ basePath: env.FILES_PATH, host: env.HOST });

    const user = createUserModule({ db, afipService });
    const persona = createPersonaModule({ db, storage, userRepository: user.repository });
    const libro = createLibroModule({ db, personaRepository: persona.repository, storage });
    const cliente = createClienteModule({ db, afipService });
    const transaccion = createTransaccionModule({
        db,
        libroService: libro.service,
        clienteRepository: cliente.repository,
        clienteStockService: cliente.stockService,
        userRepository: user.repository,
        afipService,
        comprobanteService,
        storage
    });

    const users = await seedUsers(user.service);
    const personas = await seedPersonas(users, persona.service);
    const clientes = await seedClientes(users);
    const libros = await seedLibros(users, libro.service);

    await seedLibrosPersonas(users, libros, personas, libro.personaService);
    await seedLibroCliente(users, libros, clientes, cliente.stockService);
    await seedOperaciones(
        users,
        libros,
        clientes,
        libro.service,
        cliente.stockService,
        transaccion.repository,
        transaccion.ventaRepository
    );

    console.log(`Seed listo: ${users.length} usuarios, password de todos: "${PASSWORD_SEED}"`);
    for (const u of users) {
        console.log(`  - ${u.username} (cuit ${u.cuit})`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Error corriendo los seeders:", err);
        process.exit(1);
    });
