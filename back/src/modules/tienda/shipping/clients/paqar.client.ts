import { z } from "zod";
import { ExternalServiceError } from "../../../../lib/http/errors";
import { parseProviderResponse, providerTimeout, responseBody } from "../../shared/http";

export type PaqarCredentials = {
    agreement: string;
    apiKey: string;
};

// Nombres y anidamiento del manual de PAQ.AR 2.0: el alta de orden va dentro
// de `order`, con `senderData`/`shippingData` y `parcels.dimensions`. No usar
// los nombres cortos de MiCorreo acá: son APIs distintas.
export type PaqarAddress = {
    streetName: string;
    streetNumber: string;
    cityName: string;
    floor?: string | null;
    department?: string | null;
    state: string;
    zipCode: string;
};

export type PaqarSenderData = {
    businessName: string;
    areaCodePhone?: string | null;
    phoneNumber?: string | null;
    areaCodeCellphone?: string | null;
    cellphoneNumber?: string | null;
    email?: string | null;
    observation?: string | null;
    address: PaqarAddress;
};

export type PaqarShippingData = {
    name: string;
    areaCodePhone?: string | null;
    phoneNumber?: string | null;
    areaCodeCellphone?: string | null;
    cellphoneNumber?: string | null;
    email?: string | null;
    observation?: string | null;
    address: PaqarAddress;
};

export type PaqarParcel = {
    dimensions: {
        height: string;
        width: string;
        depth: string;
    };
    productWeight: string;
    productCategory: string;
    declaredValue: string;
};

export type PaqarOrderInput = {
    sellerId: string;
    senderData: PaqarSenderData;
    shippingData: PaqarShippingData;
    parcels: PaqarParcel[];
    deliveryType: "homeDelivery";
    agencyId?: string;
    saleDate: string;
    serviceType: string;
    shipmentClientId: string;
    trackingNumber?: string | null;
};

export type PaqarOrder = {
    shipmentId: string | null;
    trackingNumber: string | null;
};

export type PaqarLabel = {
    pdf: Buffer;
    url: string | null;
};

export type PaqarTrackingEvent = {
    status: string | null;
    statusId: string | null;
    facility: string | null;
    date: Date | null;
    sign: string | null;
};

export type PaqarTracking = {
    status: string | null;
    url: string | null;
    events: PaqarTrackingEvent[];
};

export type PaqarClient = {
    auth: (credentials: PaqarCredentials) => Promise<void>;
    createOrder: (credentials: PaqarCredentials, input: PaqarOrderInput) => Promise<PaqarOrder>;
    createLabel: (
        credentials: PaqarCredentials,
        sellerId: string,
        trackingNumber: string
    ) => Promise<PaqarLabel>;
    getTracking: (credentials: PaqarCredentials, trackingNumber: string) => Promise<PaqarTracking>;
};

const idLike = z.union([z.string(), z.number()]).transform(String);
const optionalId = idLike.nullable().optional();

const orderResponseSchema = z
    .object({
        shipmentId: optionalId,
        shipmentNumber: optionalId,
        trackingNumber: optionalId,
        tracking: optionalId,
        id: optionalId,
        idSeller: optionalId,
        order: z
            .object({
                shipmentId: optionalId,
                shipmentNumber: optionalId,
                trackingNumber: optionalId,
                tracking: optionalId,
                id: optionalId,
                idSeller: optionalId
            })
            .passthrough()
            .optional()
    })
    .passthrough()
    .transform((body): PaqarOrder => {
        const nested = body.order ?? {};
        const trackingNumber =
            body.trackingNumber ?? body.tracking ??
            nested.trackingNumber ?? nested.tracking ?? null;

        return {
            shipmentId:
                body.shipmentId ?? body.shipmentNumber ?? body.id ?? body.idSeller ??
                nested.shipmentId ?? nested.shipmentNumber ?? nested.id ?? nested.idSeller ??
                trackingNumber,
            trackingNumber
        };
    });

const trackingEventSchema = z
    .object({
        status: z.string().nullable().optional(),
        statusId: optionalId,
        facility: z.string().nullable().optional(),
        date: z.string().nullable().optional(),
        sign: z.string().nullable().optional()
    })
    .passthrough();

const trackingResponseSchema = z
    .object({
        status: z.string().nullable().optional(),
        url: z.string().nullable().optional(),
        trackingUrl: z.string().nullable().optional(),
        events: z.array(trackingEventSchema).nullable().optional(),
        tracking: z
            .object({
                status: z.string().nullable().optional(),
                url: z.string().nullable().optional(),
                trackingUrl: z.string().nullable().optional(),
                events: z.array(trackingEventSchema).nullable().optional()
            })
            .passthrough()
            .optional()
    })
    .passthrough()
    .transform((body): PaqarTracking => {
        const nested = body.tracking ?? {};
        const events = body.events ?? nested.events ?? [];

        return {
            status: body.status ?? nested.status ?? null,
            url: body.url ?? body.trackingUrl ?? nested.url ?? nested.trackingUrl ?? null,
            events: events.map((event) => {
                const parsed = event.date ? new Date(event.date) : null;
                return {
                    status: event.status ?? null,
                    statusId: event.statusId ?? null,
                    facility: event.facility ?? null,
                    date: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
                    sign: event.sign ?? null
                };
            })
        };
    });

export function createHttpPaqarClient({ baseUrl }: { baseUrl: string }): PaqarClient {
    const headers = (credentials: PaqarCredentials) => ({
        Authorization: `Apikey ${credentials.apiKey}`,
        agreement: credentials.agreement
    });

    const send = async (
        credentials: PaqarCredentials,
        path: string,
        init: RequestInit
    ): Promise<Response> => {
        try {
            return await fetch(`${baseUrl}${path}`, {
                ...init,
                signal: providerTimeout(),
                headers: {
                    ...headers(credentials),
                    ...(init.headers ?? {})
                }
            });
        } catch (err) {
            throw new ExternalServiceError("PAQ.AR", "No se pudo conectar con PAQ.AR", undefined, err);
        }
    };

    const auth = async (credentials: PaqarCredentials): Promise<void> => {
        const response = await send(credentials, "/auth", { method: "GET" });

        if (!response.ok) {
            throw new ExternalServiceError(
                "PAQ.AR",
                `PAQ.AR respondió ${response.status}`,
                response.status
            );
        }
    };

    const createOrder = async (
        credentials: PaqarCredentials,
        input: PaqarOrderInput
    ): Promise<PaqarOrder> => {
        // El manual de PAQ.AR agrupa los datos de la orden dentro de `order`;
        // `sellerId` y `trackingNumber` quedan en el nivel superior.
        const payload = {
            sellerId: input.sellerId,
            trackingNumber: input.trackingNumber ?? undefined,
            order: {
                senderData: input.senderData,
                shippingData: input.shippingData,
                parcels: input.parcels,
                deliveryType: input.deliveryType,
                agencyId: input.agencyId ?? "",
                saleDate: input.saleDate,
                shipmentClientId: input.shipmentClientId,
                serviceType: input.serviceType
            }
        };

        const response = await send(credentials, "/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const body = await responseBody(response);

        // Si el proveedor ya conoce la referencia estable, puede devolver la
        // orden existente junto con un 409: se adopta en vez de duplicarla.
        if (!response.ok) {
            const existing = orderResponseSchema.safeParse(body);
            if (existing.success && existing.data.shipmentId && existing.data.trackingNumber) {
                return existing.data;
            }

            throw new ExternalServiceError(
                "PAQ.AR",
                `PAQ.AR respondió ${response.status}`,
                response.status,
                body
            );
        }

        return parseProviderResponse(
            "PAQ.AR",
            orderResponseSchema,
            body,
            "PAQ.AR no devolvió la orden"
        );
    };

    const createLabel = async (
        credentials: PaqarCredentials,
        sellerId: string,
        trackingNumber: string
    ): Promise<PaqarLabel> => {
        const response = await send(credentials, "/labels?labelFormat=10x15", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([{ sellerId, trackingNumber }])
        });

        if (!response.ok) {
            throw new ExternalServiceError(
                "PAQ.AR",
                `PAQ.AR respondió ${response.status}`,
                response.status,
                await responseBody(response)
            );
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/pdf")) {
            return { pdf: Buffer.from(await response.arrayBuffer()), url: null };
        }

        const body = await responseBody(response);
        const itemSchema = z
            .object({
                fileBase64: z.string().optional(),
                filename: z.string().optional(),
                fileName: z.string().optional(),
                status: z.string().optional(),
                result: z.string().optional(),
                url: z.string().url().optional(),
                labelUrl: z.string().url().optional(),
                pdf: z.string().optional(),
                label: z.string().optional()
            })
            .passthrough();

        const parsed = z
            .union([
                z.array(itemSchema),
                itemSchema
            ])
            .safeParse(body);
        let items: z.infer<typeof itemSchema>[] = [];
        if (parsed.success) {
            items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
        }
        const item = items[0];

        // El servicio devuelve un array con `fileBase64`, `filename`, `status`
        // y `result`. Si el resultado no es OK, el PDF viene vacío.
        if (item?.result && /error/i.test(item.result)) {
            throw new ExternalServiceError("PAQ.AR", item.result);
        }

        const base64 = item?.fileBase64 ?? item?.pdf ?? item?.label;
        if (base64) {
            return { pdf: Buffer.from(base64, "base64"), url: null };
        }

        const url = item?.url ?? item?.labelUrl ?? null;
        if (url) {
            const download = await fetch(url, { signal: providerTimeout() });
            if (!download.ok) {
                throw new ExternalServiceError(
                    "PAQ.AR",
                    `PAQ.AR respondió ${download.status} al descargar la etiqueta`,
                    download.status
                );
            }
            return { pdf: Buffer.from(await download.arrayBuffer()), url };
        }

        throw new ExternalServiceError("PAQ.AR", "PAQ.AR no devolvió la etiqueta");
    };

    const getTracking = async (
        credentials: PaqarCredentials,
        trackingNumber: string
    ): Promise<PaqarTracking> => {
        const response = await send(
            credentials,
            `/tracking?trackingNumber=${encodeURIComponent(trackingNumber)}`,
            { method: "GET" }
        );

        if (!response.ok) {
            throw new ExternalServiceError(
                "PAQ.AR",
                `PAQ.AR respondió ${response.status}`,
                response.status,
                await responseBody(response)
            );
        }

        return parseProviderResponse(
            "PAQ.AR",
            trackingResponseSchema,
            await responseBody(response),
            "PAQ.AR devolvió un seguimiento inválido"
        );
    };

    return { auth, createOrder, createLabel, getTracking };
}
