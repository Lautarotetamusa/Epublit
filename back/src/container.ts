import { db } from "./db/client";
import { env } from "./env";
import { createAfipService, AfipService } from "./lib/afip/Afip";
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
import { createComprobanteModule } from "./modules/comprobante";
import { createTransaccionModule } from "./modules/transaccion";
import { createLiquidacionesModule } from "./modules/liquidaciones";
import { createLiquidacionModule } from "./modules/liquidacion";
import { createMetricasModule } from "./modules/metricas";
import { createTiendaModule } from "./modules/tienda";
import { createAvailabilityService } from "./modules/tienda/stock/availability.service";
import {
    MercadoPagoClient,
    MercadoPagoConfig,
    createHttpMercadoPagoClient
} from "./modules/tienda/payment/mercadopago.client";
import { MicorreoClient, createHttpMicorreoClient } from "./modules/tienda/shipping/clients/micorreo.client";
import { PaqarClient, createHttpPaqarClient } from "./modules/tienda/shipping/clients/paqar.client";
import { CredentialsCipher, createCredentialsCipher } from "./lib/crypto/credentials";
import { DEFAULT_PUBLIC_RATE_LIMITS, PublicRateLimitConfig } from "./modules/tienda/shared/public.rateLimit";

export type TiendaOverrides = {
    cipher?: CredentialsCipher;
    micorreoClient?: MicorreoClient;
    paqarClient?: PaqarClient;
    mercadoPagoClient?: MercadoPagoClient;
    mercadoPagoConfig?: Partial<MercadoPagoConfig>;
    rateLimits?: PublicRateLimitConfig;
};

export type CreateContainerDeps = {
    afipService?: AfipService;
    storage?: Storage;
    tienda?: TiendaOverrides;
};

export function createContainer({
    afipService = createAfipService({ cuitProd: env.AFIP_CUIT_PROD }),
    storage = createLocalStorage({ basePath: env.FILES_PATH, host: env.HOST }),
    tienda: tiendaOverrides = {}
}: CreateContainerDeps = {}) {
    const cipher = tiendaOverrides.cipher ?? createCredentialsCipher(env.CREDENTIALS_ENCRYPTION_KEY);
    const mercadoPagoConfig: MercadoPagoConfig = {
        clientId: env.MP_CLIENT_ID,
        clientSecret: env.MP_CLIENT_SECRET,
        redirectUri: env.MP_REDIRECT_URI,
        webhookSecret: env.MP_WEBHOOK_SECRET,
        apiBaseUrl: env.MP_API_BASE_URL,
        authBaseUrl: env.MP_AUTH_BASE_URL,
        panelUrl: env.MP_PANEL_URL,
        webhookUrl: `${env.PUBLIC_API_URL.replace(/\/$/, "")}/public/tienda/v1/webhooks/mercadopago`,
        ...tiendaOverrides.mercadoPagoConfig
    };
    const micorreoClient =
        tiendaOverrides.micorreoClient ??
        createHttpMicorreoClient({ baseUrl: env.MICORREO_BASE_URL });
    const paqarClient =
        tiendaOverrides.paqarClient ?? createHttpPaqarClient({ baseUrl: env.PAQAR_BASE_URL });
    const mercadoPagoClient =
        tiendaOverrides.mercadoPagoClient ??
        createHttpMercadoPagoClient({ config: mercadoPagoConfig });
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
    // Comprobantes antes de movimiento/transacción/tienda: esos módulos
    // persisten la fila y consultan el resumen para los detalles.
    const comprobante = createComprobanteModule({
        db,
        userRepository: user.repository,
        afipService,
        storage
    });
    const movimiento = createMovimientoModule({ db, depositoRepository: deposito.repository, libroRepository: libro.repository, anticipoService: anticipo.service, comprobanteService: comprobante.service });
    // Una sola instancia de disponibilidad (stock físico - reservas + límite
    // negativo) para la tienda y las ventas internas. Se arma acá para que
    // transacción pueda inyectar el registro de ventas en tienda sin ciclos.
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
    const tienda = createTiendaModule({
        db,
        libroService: libro.service,
        depositoRepository: deposito.repository,
        availabilityService,
        cipher,
        micorreoClient,
        paqarClient,
        mercadoPagoClient,
        mercadoPagoConfig,
        userRepository: user.repository,
        clienteRepository: cliente.repository,
        medioPagoService: medioPago.service,
        ventaRepository: transaccion.ventaRepository,
        saleService: transaccion.saleService,
        comprobanteService: comprobante.service,
        storage,
        rateLimits: tiendaOverrides.rateLimits ?? DEFAULT_PUBLIC_RATE_LIMITS
    });

    const liquidaciones = createLiquidacionesModule({ db });
    const liquidacion = createLiquidacionModule({ liquidacionesService: liquidaciones.service });
    const metricas = createMetricasModule({ db });

    return { persona, libro, user, cliente, transaccion, liquidacion, liquidaciones, anticipo, coleccion, deposito, movimiento, medioPago, rol, metricas, tienda, comprobante };
}

export type Container = ReturnType<typeof createContainer>;

export const container = createContainer();
