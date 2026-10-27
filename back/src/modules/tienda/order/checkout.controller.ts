import { Request, RequestHandler } from "express";
import type { CheckoutService } from "./checkout.service";
import type { QuoteService } from "../shipping/quote.service";
import { quoteSchema } from "../shipping/quote.validator";
import type { ExpirationService } from "./expiration.service";
import { createOrderSchema, orderCodeSchema } from "./order.validator";

export type CheckoutControllerDeps = {
    service: CheckoutService;
    quoteService: Pick<QuoteService, "quote">;
    expirationService: Pick<ExpirationService, "cancel">;
};

// La web la recibe al crear el pedido y MercadoPago la devuelve como
// `external_reference` en la URL de retorno.
const buyerReference = (req: Request): string | undefined => req.header("x-pedido-referencia");

export function createCheckoutController({
    service,
    quoteService,
    expirationService
}: CheckoutControllerDeps) {
    const quoteCart: RequestHandler = async (req, res) => {
        const body = quoteSchema.parse(req.body);
        const result = await quoteService.quote(res.locals.integracion.userId, body);

        res.status(200).json(result);
    };

    const create: RequestHandler = async (req, res) => {
        const body = createOrderSchema.parse(req.body);
        const result = await service.create(
            res.locals.integracion,
            req.header("idempotency-key"),
            body
        );

        res.status(result.creado ? 201 : 200).json({ pedido: result.pedido });
    };

    const get: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.getPublic(res.locals.integracion.userId, codigo, buyerReference(req)));
    };

    const payment: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        const pago = await service.regeneratePayment(res.locals.integracion.userId, codigo, buyerReference(req));

        res.status(200).json({ pago });
    };

    const cancel: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        const { userId } = res.locals.integracion;
        const referencia = buyerReference(req);
        await service.findBuyerOrder(userId, codigo, referencia);
        await expirationService.cancel(userId, codigo);
        const pedido = await service.getPublic(userId, codigo, referencia);

        res.status(200).json(pedido);
    };

    return { quoteCart, create, get, payment, cancel };
}

export type CheckoutController = ReturnType<typeof createCheckoutController>;
