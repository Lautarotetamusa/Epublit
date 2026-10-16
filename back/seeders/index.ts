import { db } from "../src/db/client";
import { createMockAfipService } from "../src/lib/afip/Afip.mock";
import { createMockComprobanteService } from "../src/lib/comprobantes/comprobante.mock";
import { createLocalStorage } from "../src/lib/storage";
import { env } from "../src/env";
import { createPersonaModule } from "../src/modules/persona";
import { createColeccionModule } from "../src/modules/coleccion";
import { createDepositoModule } from "../src/modules/deposito";
import { createMovimientoModule } from "../src/modules/movimiento";
import { createLibroModule } from "../src/modules/libro";
import { createUserModule } from "../src/modules/user";
import { createClienteModule } from "../src/modules/cliente";
import { createMedioPagoModule } from "../src/modules/medioPago";
import { createRolModule } from "../src/modules/rol";
import { createAnticipoModule } from "../src/modules/anticipo";
import { createTransaccionModule } from "../src/modules/transaccion";
import { createLiquidacionesModule } from "../src/modules/liquidaciones";
import { resetSeedData } from "./reset";
import { seedUsers, PASSWORD_SEED } from "./users.seeder";
import { seedPersonas } from "./personas.seeder";
import { seedColecciones } from "./colecciones.seeder";
import { seedClientes } from "./clientes.seeder";
import { seedLibros } from "./libros.seeder";
import { seedLibrosPersonas } from "./librosPersonas.seeder";
import { seedLibroCliente } from "./libroCliente.seeder";
import { seedOperaciones } from "./operaciones.seeder";
import { seedAnticipos } from "./anticipos.seeder";
import { seedLiquidaciones } from "./liquidaciones.seeder";

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

    const deposito = createDepositoModule({ db });
    const medioPago = createMedioPagoModule({ db });
    const rol = createRolModule({ db });
    const anticipo = createAnticipoModule({ db });
    const user = createUserModule({ db, afipService, depositoRepository: deposito.repository, medioPagoRepository: medioPago.repository, rolRepository: rol.repository });
    const persona = createPersonaModule({ db, storage, userRepository: user.repository, rolRepository: rol.repository });
    const coleccion = createColeccionModule({ db, storage });
    const libro = createLibroModule({ db, personaRepository: persona.repository, coleccionRepository: coleccion.repository, depositoRepository: deposito.repository, rolRepository: rol.repository, anticipoService: anticipo.service, storage });
    const cliente = createClienteModule({ db, afipService, depositoRepository: deposito.repository });
    const movimiento = createMovimientoModule({ db, depositoRepository: deposito.repository, libroRepository: libro.repository, anticipoService: anticipo.service, storage });
    const transaccion = createTransaccionModule({
        db,
        libroService: libro.service,
        clienteRepository: cliente.repository,
        clienteStockService: cliente.stockService,
        movimientoRepository: movimiento.repository,
        depositoRepository: deposito.repository,
        userRepository: user.repository,
        medioPagoService: medioPago.service,
        afipService,
        comprobanteService,
        storage
    });
    const liquidaciones = createLiquidacionesModule({ db });

    const users = await seedUsers(user.service);
    await seedColecciones(users, coleccion.service);
    const personas = await seedPersonas(users, persona.service);
    const clientes = await seedClientes(users, deposito.repository);
    const libros = await seedLibros(users, libro.service, deposito.repository);

    await seedLibrosPersonas(users, libros, personas, libro.personaService, rol.service);
    await seedLibroCliente(users, libros, clientes, deposito.repository, cliente.stockService);
    await seedOperaciones(
        users,
        libros,
        clientes,
        deposito.repository,
        cliente.stockService,
        movimiento.repository,
        transaccion.ventaRepository
    );

    await seedAnticipos(users, libros, deposito.repository, movimiento.repository, anticipo.service);
    await seedLiquidaciones(users, liquidaciones.service);

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
