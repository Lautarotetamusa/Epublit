import { z } from "zod";
import type { RequestHandler } from "express";
import type { WebhookRequest, WebhookService } from "./webhook.service";

export type WebhookControllerDeps = { service: WebhookService };

const idValue = z.union([z.string().min(1), z.number()]).transform(String);

const bodySchema = z
    .object({
        type: z.string().optional(),
        user_id: idValue.optional(),
        data: z.object({ id: idValue.optional() }).optional()
    })
    .default({});

const querySchema = z
    .object({
        type: z.string().optional(),
        user_id: idValue.optional(),
        "data.id": idValue.optional()
    })
    .default({});

const headerValue = z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (Array.isArray(value) ? value[0] ?? null : value ?? null));

const headersSchema = z.object({
    "x-signature": headerValue,
    "x-request-id": headerValue
});

// MercadoPago manda los datos de la notificación en query y/o body según la
// versión del evento. El schema los normaliza una sola vez para que el service
// reciba un único WebhookRequest.
const webhookRequestSchema = z
    .object({
        body: bodySchema,
        query: querySchema,
        headers: headersSchema
    })
    .transform(({ body, query, headers }): WebhookRequest => ({
        signature: headers["x-signature"],
        requestId: headers["x-request-id"],
        dataId: query["data.id"] ?? body.data?.id ?? null,
        type: query.type ?? body.type ?? null,
        userId: query.user_id ?? body.user_id ?? null
    }));

export function createWebhookController({ service }: WebhookControllerDeps) {
    const mercadopago: RequestHandler = async (req, res) => {
        const request = webhookRequestSchema.parse({
            body: req.body,
            query: req.query,
            headers: req.headers
        });
        const result = await service.process(request);

        res.status(200).json(result);
    };

    return { mercadopago };
}

export type WebhookController = ReturnType<typeof createWebhookController>;
