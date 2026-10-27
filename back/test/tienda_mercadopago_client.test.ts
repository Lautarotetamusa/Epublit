import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalServiceError } from "../src/lib/http/errors";
import { createHttpMercadoPagoClient } from "../src/modules/tienda/payment/mercadopago.client";
import type { MercadoPagoConfig } from "../src/modules/tienda/payment/mercadopago.client";

const config: MercadoPagoConfig = {
    clientId: "client",
    clientSecret: "secret",
    redirectUri: "https://api.test/tienda/mercadopago/callback",
    webhookSecret: "webhook",
    apiBaseUrl: "https://mp.test",
    authBaseUrl: "https://auth.mp.test",
    panelUrl: "https://panel.test",
    webhookUrl: "https://api.test/public/tienda/v1/webhooks/mercadopago"
};

const fetchResponse = (body: unknown, status = 200) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body)
    }) as Response;

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Cliente HTTP de MercadoPago", () => {
    it("rechaza un pago sin los campos obligatorios", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => fetchResponse({ id: 1, status: "approved" })));
        const client = createHttpMercadoPagoClient({ config });

        await expect(client.getPayment("access-token", "1")).rejects.toBeInstanceOf(ExternalServiceError);
    });

    it("rechaza una respuesta OAuth sin access_token", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => fetchResponse({ refresh_token: "refresh" })));
        const client = createHttpMercadoPagoClient({ config });

        await expect(client.exchangeCode("code")).rejects.toBeInstanceOf(ExternalServiceError);
    });

    it("parsea un pago válido con importe y moneda requeridos", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                fetchResponse({
                    id: 123,
                    status: "approved",
                    transaction_amount: 1000,
                    currency_id: "ARS",
                    external_reference: "ref-1"
                })
            )
        );
        const client = createHttpMercadoPagoClient({ config });

        await expect(client.getPayment("access-token", "123")).resolves.toMatchObject({
            id: "123",
            status: "approved",
            transaction_amount: 1000,
            currency_id: "ARS",
            external_reference: "ref-1"
        });
    });
});
