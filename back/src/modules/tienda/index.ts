import express from "express";
import { Database } from "../../db/client";
import { AfipService } from "../../lib/afip/Afip";
import { ComprobanteService } from "../../lib/comprobantes/comprobante";
import { CredentialsCipher } from "../../lib/crypto/credentials";
import { Storage } from "../../lib/storage/storage";
import { ClienteRepository } from "../cliente";
import { DepositoRepository } from "../deposito";
import { LibroService } from "../libro";
import { MedioPagoService } from "../medioPago";
import { MovimientoRepository } from "../movimiento";
import { UserRepository } from "../user";
import { SaleService } from "../transaccion/sale.service";
import { VentaRepository } from "../transaccion/venta.repository";
import { createCatalogController } from "./catalog/catalog.controller";
import { createCatalogRepository } from "./catalog/catalog.repository";
import { createCatalogRoutes } from "./catalog/catalog.routes";
import { createCatalogService } from "./catalog/catalog.service";
import { createCheckoutController } from "./order/checkout.controller";
import { createCheckoutRoutes } from "./order/checkout.routes";
import { createCheckoutService } from "./order/checkout.service";
import { MercadoPagoClient, MercadoPagoConfig } from "./payment/mercadopago.client";
import { MicorreoClient } from "./shipping/clients/micorreo.client";
import { PaqarClient } from "./shipping/clients/paqar.client";
import { createQuoteService } from "./shipping/quote.service";
import { AvailabilityService } from "./stock/availability.service";
import { createShippingConfigController } from "./shipping/shippingConfig.controller";
import { createShippingConfigRepository } from "./shipping/shippingConfig.repository";
import { createShippingConfigRoutes } from "./shipping/shippingConfig.routes";
import { createShippingConfigService } from "./shipping/shippingConfig.service";
import { createExpirationService } from "./order/expiration.service";
import { createIntegrationController } from "./integration/integration.controller";
import { createIntegrationRepository } from "./integration/integration.repository";
import { createIntegrationRoutes } from "./integration/integration.routes";
import { createIntegrationService } from "./integration/integration.service";
import { createMercadoPagoCallbackRoutes } from "./payment/mercadopagoCallback.routes";
import { createMercadoPagoController } from "./payment/mercadopago.controller";
import { createMercadoPagoRepository } from "./payment/mercadopago.repository";
import { createMercadoPagoRoutes } from "./payment/mercadopago.routes";
import { createMercadoPagoService } from "./payment/mercadopago.service";
import { createPaymentRepository } from "./payment/payment.repository";
import { createOrderRepository } from "./order/order.repository";
import { createOrderAdminRepository } from "./order/orderAdmin.repository";
import { createOrderAdminService } from "./order/orderAdmin.service";
import { createOrderAdminController } from "./order/orderAdmin.controller";
import { createOrderAdminRoutes } from "./order/orderAdmin.routes";
import { createInvoiceService } from "./order/invoice.service";
import { createLabelService } from "./order/label.service";
import { createTrackingService } from "./order/tracking.service";
import { createShipmentRepository } from "./shipping/shipment.repository";
import { createPublicAuth } from "./shared/public.auth";
import { handlePublicErrors, sendPublicError } from "./shared/public.errors";
import { createWebhookController } from "./payment/webhook.controller";
import { createWebhookRepository } from "./payment/webhook.repository";
import { createWebhookRoutes } from "./payment/webhook.routes";
import { createPublicRateLimits, PublicRateLimitConfig } from "./shared/public.rateLimit";
import { createWebhookService } from "./payment/webhook.service";

export type TiendaModuleDeps = {
    db: Database;
    libroService: LibroService;
    depositoRepository: Pick<DepositoRepository, "findPrincipal">;
    // El contenedor arma una sola instancia y la comparte con transacción.
    availabilityService: AvailabilityService;
    cipher: CredentialsCipher;
    micorreoClient: MicorreoClient;
    paqarClient: PaqarClient;
    mercadoPagoClient: MercadoPagoClient;
    mercadoPagoConfig: MercadoPagoConfig;
    userRepository: Pick<UserRepository, "findOne">;
    clienteRepository: Pick<ClienteRepository, "findConsumidorFinal" | "findOne">;
    medioPagoService: Pick<MedioPagoService, "findActivos" | "findActivo">;
    movimientoRepository: MovimientoRepository;
    ventaRepository: Pick<VentaRepository, "findRowByIdMovimiento">;
    saleService: SaleService;
    afipService: AfipService;
    comprobanteService: ComprobanteService;
    storage: Storage;
    rateLimits: PublicRateLimitConfig;
};

export function createTiendaModule({
    db,
    libroService,
    depositoRepository,
    availabilityService,
    cipher,
    micorreoClient,
    paqarClient,
    mercadoPagoClient,
    mercadoPagoConfig,
    userRepository,
    clienteRepository,
    medioPagoService,
    movimientoRepository,
    ventaRepository,
    saleService,
    afipService,
    comprobanteService,
    storage,
    rateLimits
}: TiendaModuleDeps) {
    const integrationRepository = createIntegrationRepository({ db });
    const integrationService = createIntegrationService({ repository: integrationRepository });
    const integrationController = createIntegrationController({ service: integrationService });
    const router = createIntegrationRoutes(integrationController);

    const catalogRepository = createCatalogRepository({ db });
    const catalogService = createCatalogService({ libroService, repository: catalogRepository });
    const catalogController = createCatalogController({ service: catalogService });
    const catalogRouter = createCatalogRoutes(catalogController);

    const shippingConfigRepository = createShippingConfigRepository({ db });
    const shippingConfigService = createShippingConfigService({
        repository: shippingConfigRepository,
        cipher,
        micorreoClient,
        paqarClient
    });
    const shippingConfigController = createShippingConfigController({ service: shippingConfigService });
    const shippingConfigRoutes = createShippingConfigRoutes(shippingConfigController);

    const mercadoPagoRepository = createMercadoPagoRepository({ db });
    const mercadoPagoService = createMercadoPagoService({
        repository: mercadoPagoRepository,
        client: mercadoPagoClient,
        cipher,
        config: mercadoPagoConfig
    });
    const mercadoPagoController = createMercadoPagoController({ service: mercadoPagoService });
    const mercadoPagoRoutes = createMercadoPagoRoutes(mercadoPagoController);
    const oauthCallbackRouter = createMercadoPagoCallbackRoutes(mercadoPagoController);

    const orderRepository = createOrderRepository({ db });
    const orderAdminRepository = createOrderAdminRepository({ db });
    const paymentRepository = createPaymentRepository({ db });
    const shipmentRepository = createShipmentRepository({ db });
    const webhookRepository = createWebhookRepository({ db });

    const quoteService = createQuoteService({
        libroService,
        availabilityService,
        shippingConfigService,
        micorreoClient
    });

    const checkoutService = createCheckoutService({
        db,
        orderRepository,
        paymentRepository,
        quoteService,
        availabilityService,
        mercadoPagoService,
        mercadoPagoClient
    });

    const expirationService = createExpirationService({
        db,
        orderRepository,
        paymentRepository,
        availabilityService
    });

    const checkoutController = createCheckoutController({
        service: checkoutService,
        quoteService,
        expirationService
    });
    const checkoutRoutes = createCheckoutRoutes(checkoutController);

    const webhookService = createWebhookService({
        db,
        orderRepository,
        paymentRepository,
        webhookRepository,
        availabilityService,
        mercadoPagoService,
        mercadoPagoClient,
        secret: mercadoPagoConfig.webhookSecret
    });
    const webhookController = createWebhookController({ service: webhookService });
    const webhookRoutes = createWebhookRoutes(webhookController);

    const invoiceService = createInvoiceService({
        db,
        orderRepository,
        ventaRepository,
        movimientoRepository,
        clienteRepository,
        medioPagoService,
        userRepository,
        afipService,
        comprobanteService
    });
    const labelService = createLabelService({
        db,
        orderRepository,
        shipmentRepository,
        shippingConfigService,
        paqarClient,
        storage,
        userRepository
    });
    const trackingService = createTrackingService({
        db,
        orderRepository,
        shipmentRepository,
        shippingConfigService,
        paqarClient
    });
    const orderAdminService = createOrderAdminService({
        db,
        orderRepository,
        orderAdminRepository,
        paymentRepository,
        shipmentRepository,
        ventaRepository,
        clienteRepository,
        depositoRepository,
        medioPagoService,
        libroService,
        availabilityService,
        saleService,
        invoiceService,
        labelService,
        trackingService,
        mercadoPagoService,
        mercadoPagoClient,
        storage
    });
    const orderAdminController = createOrderAdminController({ service: orderAdminService });
    const orderAdminRouter = createOrderAdminRoutes(orderAdminController);

    const adminRouter = express.Router();
    adminRouter.use(shippingConfigRoutes);
    adminRouter.use(mercadoPagoRoutes);

    const publicRouter = express.Router();
    // El webhook es la única ruta pública sin API key.
    publicRouter.use(webhookRoutes);
    const limits = createPublicRateLimits(rateLimits);
    publicRouter.use(limits.requests);
    publicRouter.post("/pedidos", limits.pedidos);
    publicRouter.use(createPublicAuth({ service: integrationService }));
    publicRouter.use(catalogRouter);
    publicRouter.use(checkoutRoutes);
    publicRouter.use((_req, res) => sendPublicError(res, 404, "no_encontrado", "La ruta no existe"));
    publicRouter.use(handlePublicErrors);

    return {
        router,
        adminRouter,
        orderAdminRouter,
        publicRouter,
        oauthCallbackRouter,
        integrationService,
        catalogService,
        availabilityService,
        shippingConfigService,
        mercadoPagoService,
        quoteService,
        checkoutService,
        expirationService,
        webhookService,
        repositories: {
            orders: orderRepository,
            payments: paymentRepository,
            mercadoPago: mercadoPagoRepository,
            shippingConfig: shippingConfigRepository,
            webhook: webhookRepository
        }
    };
}

export type TiendaModule = ReturnType<typeof createTiendaModule>;
