import { db } from "../src/db/client";
import { createMockAfipService } from "../src/lib/afip/Afip.mock";
import { createLocalStorage } from "../src/lib/storage";
import { createCredentialsCipher } from "../src/lib/crypto/credentials";
import { env } from "../src/env";
import { createEmailService, createTransporteLog } from "../src/lib/email";
import { createPersonaModule } from "../src/modules/persona";
import { createColeccionModule } from "../src/modules/coleccion";
import { createDepositoModule } from "../src/modules/deposito";
import { createMovimientoModule } from "../src/modules/movimiento";
import { createLibroModule } from "../src/modules/libro";
import { createUserModule } from "../src/modules/user";
import { createClienteModule } from "../src/modules/cliente";
import { createMedioPagoModule } from "../src/modules/medioPago";
import { createRolModule } from "../src/modules/rol";
import { createTipoEdicionModule } from "../src/modules/tipoEdicion";
import { createAnticipoModule } from "../src/modules/anticipo";
import { createComprobanteModule } from "../src/modules/comprobante";
import { createTransaccionModule } from "../src/modules/transaccion";
import { createAvailabilityService } from "../src/modules/tienda/stock/availability.service";
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
import { seedLiquidacionHistorica, seedLiquidaciones } from "./liquidaciones.seeder";
import { seedMetricas } from "./metricas.seeder";
import { seedTienda } from "./tienda.seeder";
import { seedCertificados } from "./certificados.seeder";

// Orden fijo por dependencia de FKs: cada seeder recibe lo que ya generaron
// los anteriores (DI por parámetros, no un estado global compartido).
async function main(): Promise<void> {
    await resetSeedData();

    // Mock, no el real: un seeder de desarrollo no puede depender de una
    // llamada de red real a AFIP (ver seeders/clientes.seeder.ts). Con el mock
    // `seedOperaciones` deja facturas emitidas para ver e imprimir.
    const afipService = createMockAfipService();
    const storage = createLocalStorage({ basePath: env.FILES_PATH, host: env.HOST });
    const cipher = createCredentialsCipher(env.CREDENTIALS_ENCRYPTION_KEY);

    const deposito = createDepositoModule({ db });
    const medioPago = createMedioPagoModule({ db });
    const rol = createRolModule({ db });
    const tipoEdicion = createTipoEdicionModule({ db });
    const anticipo = createAnticipoModule({ db });
    // El seed no pasa por `register`, así que nunca manda la bienvenida.
    const emailService = createEmailService({ transporte: createTransporteLog(), panelUrl: env.PANEL_URL });
    const user = createUserModule({ db, afipService, emailService, depositoRepository: deposito.repository, medioPagoRepository: medioPago.repository, rolRepository: rol.repository, tipoEdicionRepository: tipoEdicion.repository });
    const persona = createPersonaModule({ db, storage, userRepository: user.repository, rolRepository: rol.repository });
    const coleccion = createColeccionModule({ db, storage });
    const libro = createLibroModule({ db, personaRepository: persona.repository, coleccionRepository: coleccion.repository, depositoRepository: deposito.repository, rolRepository: rol.repository, tipoEdicionRepository: tipoEdicion.repository, anticipoService: anticipo.service, storage });
    const cliente = createClienteModule({ db, afipService, depositoRepository: deposito.repository });
    const comprobante = createComprobanteModule({
        db,
        userRepository: user.repository,
        afipService,
        storage
    });
    const movimiento = createMovimientoModule({ db, depositoRepository: deposito.repository, libroRepository: libro.repository, anticipoService: anticipo.service, comprobanteService: comprobante.service });
    const availabilityService = createAvailabilityService({ db, depositoRepository: deposito.repository });
    const transaccion = createTransaccionModule({
        db,
        libroService: libro.service,
        clienteRepository: cliente.repository,
        clienteStockService: cliente.stockService,
        movimientoRepository: movimiento.repository,
        depositoRepository: deposito.repository,
        userRepository: user.repository,
        medioPagoService: medioPago.service,
        comprobanteService: comprobante.service,
        availabilityService
    });
    const liquidaciones = createLiquidacionesModule({ db, anticipoRepository: anticipo.repository });

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
        transaccion.ventaRepository,
        comprobante.service
    );

    await seedAnticipos(users, libros, deposito.repository, movimiento.repository, anticipo.service);
    await seedLiquidaciones(users, liquidaciones.service);

    // Último: reparte ventas e ingresos de los últimos meses para el panel de
    // métricas (ver specs/014) sin tocar las ventas de octubre que usan
    // Liquidaciones ni los anticipos ya generados.
    await seedMetricas(users, libros, clientes, {
        depositoRepository: deposito.repository,
        clienteStockService: cliente.stockService,
        movimientoRepository: movimiento.repository,
        ventaRepository: transaccion.ventaRepository
    });
    await seedLiquidacionHistorica(users, {
        libros,
        personas,
        libroService: libro.service,
        libroPersonaService: libro.personaService,
        rolService: rol.service,
        liquidacionesService: liquidaciones.service
    });

    await seedTienda({
        users,
        libros,
        depositoRepository: deposito.repository,
        availabilityService,
        saleService: transaccion.saleService,
        clienteRepository: cliente.repository,
        medioPagoService: medioPago.service,
        storage,
        cipher
    });

    const certificados = await seedCertificados(users);

    console.log(`Seed listo: ${users.length} usuarios, password de todos: "${PASSWORD_SEED}"`);
    for (const u of users) {
        console.log(`  - ${u.username} (cuit ${u.cuit})`);
    }
    console.log("Certificados de prueba para subir desde Perfil › Facturación electrónica:");
    for (const c of certificados) {
        console.log(`  - ${c.username}: ${c.vigente}`);
        console.log(`    por vencer: ${c.porVencer}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Error corriendo los seeders:", err);
        process.exit(1);
    });
