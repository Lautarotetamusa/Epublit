import { db } from "./db/client";
import { env } from "./env";
import { createAfipService, AfipService } from "./lib/afip/Afip";
import { createComprobanteService, ComprobanteService } from "./lib/comprobantes/comprobante";
import { createLocalStorage } from "./lib/storage";
import { Storage } from "./lib/storage/storage";
import { createPersonaModule } from "./modules/persona";
import { createColeccionModule } from "./modules/coleccion";
import { createDepositoModule } from "./modules/deposito";
import { createMovimientoModule } from "./modules/movimiento";
import { createLibroModule } from "./modules/libro";
import { createUserModule } from "./modules/user";
import { createClienteModule } from "./modules/cliente";
import { createRolModule } from "./modules/rol";
import { createMedioPagoModule } from "./modules/medioPago";
import { createAnticipoModule } from "./modules/anticipo";
import { createTransaccionModule } from "./modules/transaccion";
import { createLiquidacionesModule } from "./modules/liquidaciones";
import { createLiquidacionModule } from "./modules/liquidacion";
import { createMetricasModule } from "./modules/metricas";

export type CreateContainerDeps = {
    afipService?: AfipService;
    storage?: Storage;
    comprobanteService?: ComprobanteService;
};

export function createContainer({
    afipService = createAfipService({ cuitProd: env.AFIP_CUIT_PROD }),
    storage = createLocalStorage({ basePath: env.FILES_PATH, host: env.HOST }),
    comprobanteService = createComprobanteService({ storage })
}: CreateContainerDeps = {}) {
    // Depósito primero: el alta de usuario le crea su depósito principal y el
    // resto de los módulos leen/escriben stock por depósito.
    const deposito = createDepositoModule({ db });
    // Roles antes de user: el alta de usuario crea los roles por defecto; el
    // resto de los módulos los resuelven al asignar personas a un libro.
    const rol = createRolModule({ db });
    // Medio de pago antes de user: el alta de usuario crea sus 5 medios por
    // defecto, y transaccion los resuelve al vender.
    const medioPago = createMedioPagoModule({ db });
    // Anticipos antes de libro/movimiento: ambos disparan su generación (el
    // lanzamiento de un libro es la primera incorporación de stock, ver
    // specs/012-liquidaciones-pagos).
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
    const liquidacion = createLiquidacionModule({ liquidacionesService: liquidaciones.service });
    const metricas = createMetricasModule({ db });

    return { persona, libro, user, cliente, transaccion, liquidacion, liquidaciones, anticipo, coleccion, deposito, movimiento, medioPago, rol, metricas };
}

export type Container = ReturnType<typeof createContainer>;

export const container = createContainer();
