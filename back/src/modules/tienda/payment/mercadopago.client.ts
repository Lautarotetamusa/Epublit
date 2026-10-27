import { z } from "zod";
import { parseProviderResponse, requestJson } from "../shared/http";

export type MercadoPagoConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    webhookSecret: string;
    apiBaseUrl: string;
    authBaseUrl: string;
    panelUrl: string;
    webhookUrl: string;
};

export type MercadoPagoOAuthTokens = {
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    userId: string | null;
    clientId: string | null;
    scope: string | null;
};

export type MercadoPagoUser = {
    id: string;
    alias: string | null;
    email: string | null;
};

export type MercadoPagoPreference = {
    id: string;
    initPoint: string;
};

export type MercadoPagoPayment = {
    id: string;
    status: string;
    transaction_amount: number;
    currency_id: string;
    status_detail?: string | null;
    external_reference?: string | null;
    user_id?: string | null;
    collector_id?: string | null;
    date_approved?: string | null;
    metadata?: Record<string, unknown> | null;
    [key: string]: unknown;
};

export type MercadoPagoClient = {
    exchangeCode: (code: string) => Promise<MercadoPagoOAuthTokens>;
    refreshToken: (refreshToken: string) => Promise<MercadoPagoOAuthTokens>;
    getUser: (accessToken: string) => Promise<MercadoPagoUser>;
    createPreference: (accessToken: string, body: unknown) => Promise<MercadoPagoPreference>;
    getPayment: (accessToken: string, paymentId: string) => Promise<MercadoPagoPayment>;
    refundPayment: (accessToken: string, paymentId: string) => Promise<unknown>;
};

const idSchema = z.union([z.string(), z.number()]).transform(String);

const oauthResponseSchema = z
    .object({
        access_token: z.string().min(1),
        refresh_token: z.string().nullable().optional(),
        expires_in: z.coerce.number().positive().optional(),
        user_id: idSchema.nullable().optional(),
        client_id: idSchema.nullable().optional(),
        scope: z.string().nullable().optional()
    })
    .transform((body): MercadoPagoOAuthTokens => ({
        accessToken: body.access_token,
        refreshToken: body.refresh_token ?? null,
        expiresIn: body.expires_in ?? 180 * 24 * 60 * 60,
        userId: body.user_id ?? null,
        clientId: body.client_id ?? null,
        scope: body.scope ?? null
    }));

const userResponseSchema = z
    .object({
        id: idSchema,
        nickname: z.string().nullable().optional(),
        email: z.string().nullable().optional()
    })
    .transform((body): MercadoPagoUser => ({
        id: body.id,
        alias: body.nickname ?? null,
        email: body.email ?? null
    }));

const preferenceResponseSchema = z
    .object({
        id: idSchema,
        init_point: z.string().url()
    })
    .transform((body): MercadoPagoPreference => ({
        id: body.id,
        initPoint: body.init_point
    }));

const paymentResponseSchema = z
    .object({
        id: idSchema,
        status: z.string().min(1),
        transaction_amount: z.number().finite(),
        currency_id: z.string().min(1),
        status_detail: z.string().nullable().optional(),
        external_reference: z.string().nullable().optional(),
        user_id: idSchema.nullable().optional(),
        collector_id: idSchema.nullable().optional(),
        date_approved: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).nullable().optional()
    })
    .passthrough()
    .transform((body): MercadoPagoPayment => ({
        ...body,
        id: body.id,
        user_id: body.user_id ?? null,
        collector_id: body.collector_id ?? null
    }));

export function createHttpMercadoPagoClient({ config }: { config: MercadoPagoConfig }): MercadoPagoClient {
    const oauth = async (payload: Record<string, string>): Promise<MercadoPagoOAuthTokens> => {
        const body = await requestJson<unknown>("MercadoPago", `${config.apiBaseUrl}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(payload).toString()
        });

        return parseProviderResponse(
            "MercadoPago",
            oauthResponseSchema,
            body,
            "MercadoPago devolvió una respuesta OAuth inválida"
        );
    };

    const exchangeCode = (code: string) =>
        oauth({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: config.redirectUri
        });

    const refreshToken = (refreshTokenValue: string) =>
        oauth({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshTokenValue
        });

    const getUser = async (accessToken: string): Promise<MercadoPagoUser> => {
        const body = await requestJson<unknown>("MercadoPago", `${config.apiBaseUrl}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        return parseProviderResponse(
            "MercadoPago",
            userResponseSchema,
            body,
            "MercadoPago no devolvió el usuario"
        );
    };

    const createPreference = async (accessToken: string, body: unknown): Promise<MercadoPagoPreference> => {
        const result = await requestJson<unknown>(
            "MercadoPago",
            `${config.apiBaseUrl}/checkout/preferences`,
            {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }
        );

        return parseProviderResponse(
            "MercadoPago",
            preferenceResponseSchema,
            result,
            "MercadoPago no devolvió la preferencia"
        );
    };

    const getPayment = async (accessToken: string, paymentId: string): Promise<MercadoPagoPayment> => {
        const body = await requestJson<unknown>(
            "MercadoPago",
            `${config.apiBaseUrl}/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        return parseProviderResponse(
            "MercadoPago",
            paymentResponseSchema,
            body,
            "MercadoPago devolvió un pago inválido"
        );
    };

    const refundPayment = (accessToken: string, paymentId: string) =>
        requestJson<unknown>("MercadoPago", `${config.apiBaseUrl}/v1/payments/${paymentId}/refunds`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                // Reintentar el reembolso de un mismo pago no debe duplicarlo.
                "X-Idempotency-Key": `refund-${paymentId}`
            },
            body: "{}"
        });

    return { exchangeCode, refreshToken, getUser, createPreference, getPayment, refundPayment };
}
