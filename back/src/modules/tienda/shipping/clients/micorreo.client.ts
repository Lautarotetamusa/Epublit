import { z } from "zod";
import { ExternalServiceError } from "../../../../lib/http/errors";
import { parseProviderResponse, requestJson } from "../../shared/http";

export type MicorreoCredentials = {
    usuario: string;
    password: string;
};

export type MicorreoToken = {
    token: string;
    expiresAt: Date;
};

export type MicorreoRateRequest = {
    customerId: string;
    postalCodeOrigin: string;
    postalCodeDestination: string;
    deliveredType: "D" | "S";
    dimensions: {
        weight: number;
        height: number;
        width: number;
        length: number;
    };
};

export type MicorreoRate = {
    costo: number;
    plazo: string;
};

export type MicorreoClient = {
    getToken: (credentials: MicorreoCredentials) => Promise<MicorreoToken>;
    getRates: (token: string, request: MicorreoRateRequest) => Promise<MicorreoRate[]>;
};

const tokenResponseSchema = z.object({
    token: z.string().min(1),
    expires: z.union([z.number(), z.string()]).nullable().optional()
});

// MiCorreo devuelve un array de tarifas o un objeto `{ rates: [...] }` según
// la versión del contrato. El esquema valida el sobre; `normalizeRate` es el
// único lugar que resuelve los aliases históricos de precio y plazo.
const rateSchema = z.record(z.string(), z.unknown());
const ratesResponseSchema = z.union([
    z.array(rateSchema),
    z.object({ rates: z.array(rateSchema) })
]);

const expiryFrom = (expires: number | string | null | undefined): Date => {
    if (typeof expires === "number") {
        if (expires < 1_000_000_000) return new Date(Date.now() + expires * 1000);
        return new Date(expires < 1_000_000_000_000 ? expires * 1000 : expires);
    }
    if (typeof expires === "string") {
        const parsed = new Date(expires);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date(Date.now() + 60 * 60 * 1000);
};

const normalizeRate = (rate: Record<string, unknown>): MicorreoRate => {
    const price = rate.price ?? rate.cost ?? rate.rate ?? rate.importe ?? rate.valor;
    const costo = Number(price);
    if (!Number.isFinite(costo)) {
        throw new ExternalServiceError("MiCorreo", "MiCorreo no devolvió un precio de envío válido");
    }

    const min = rate.deliveryTimeMin ?? rate.delivery_min ?? rate.minDays;
    const max = rate.deliveryTimeMax ?? rate.delivery_max ?? rate.maxDays;

    if (typeof min === "number" && typeof max === "number") {
        return { costo, plazo: `${min} a ${max} días` };
    }
    if (typeof rate.deliveryTime === "string") return { costo, plazo: rate.deliveryTime };
    if (typeof rate.plazo === "string") return { costo, plazo: rate.plazo };
    if (typeof max === "number") return { costo, plazo: `${max} días` };

    return { costo, plazo: "Plazo a confirmar" };
};

export function createHttpMicorreoClient({ baseUrl }: { baseUrl: string }): MicorreoClient {
    const getToken = async (credentials: MicorreoCredentials): Promise<MicorreoToken> => {
        const basic = Buffer.from(`${credentials.usuario}:${credentials.password}`).toString("base64");
        const body = await requestJson<unknown>("MiCorreo", `${baseUrl}/token`, {
            method: "POST",
            headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" }
        });

        const parsed = parseProviderResponse(
            "MiCorreo",
            tokenResponseSchema,
            body,
            "MiCorreo no devolvió un token"
        );

        return { token: parsed.token, expiresAt: expiryFrom(parsed.expires) };
    };

    const getRates = async (token: string, request: MicorreoRateRequest): Promise<MicorreoRate[]> => {
        const body = await requestJson<unknown>("MiCorreo", `${baseUrl}/rates`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(request)
        });

        const parsed = parseProviderResponse(
            "MiCorreo",
            ratesResponseSchema,
            body,
            "MiCorreo no devolvió tarifas válidas"
        );
        const rates = Array.isArray(parsed) ? parsed : parsed.rates;
        const homeDeliveryRate = rates.find((item) => item.deliveredType === "D") ?? rates[0];

        if (!homeDeliveryRate) {
            throw new ExternalServiceError("MiCorreo", "MiCorreo no devolvió tarifas para el envío");
        }

        return [normalizeRate(homeDeliveryRate)];
    };

    return { getToken, getRates };
}
