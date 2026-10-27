import request from "supertest";
import { vi } from "vitest";
import type { Express } from "express";
import { eq } from "drizzle-orm";

import { createApp } from "../src/app";
import { createContainer } from "../src/container";
import { db } from "../src/db/client";
import { createMockAfipService } from "../src/lib/afip/Afip.mock";
import { createMockComprobanteService } from "../src/lib/comprobantes/comprobante.mock";
import type { AfipService } from "../src/lib/afip/Afip";
import type { ComprobanteService } from "../src/lib/comprobantes/comprobante";
import type { Storage } from "../src/lib/storage/storage";
import { shippingConfigTable } from "../src/modules/tienda/shipping/shippingConfig.schema";
import { mercadoPagoTable } from "../src/modules/tienda/payment/mercadopago.schema";
import { usersTable } from "../src/modules/user/user.schema";
import { MicorreoClient } from "../src/modules/tienda/shipping/clients/micorreo.client";
import { PaqarClient } from "../src/modules/tienda/shipping/clients/paqar.client";
import {
    MercadoPagoClient,
    MercadoPagoConfig
} from "../src/modules/tienda/payment/mercadopago.client";
import { PASSWORD_SEED } from "../seeders/users.seeder";

export const ORIGEN_TIENDA = "https://tienda-fase2.test";

export const MP_CONFIG: MercadoPagoConfig = {
    clientId: "client-id-test",
    clientSecret: "client-secret-test",
    redirectUri: "https://api.test/tienda/mercadopago/callback",
    webhookSecret: "webhook-secret-test",
    apiBaseUrl: "https://mp-api.test",
    authBaseUrl: "https://mp-auth.test",
    panelUrl: "https://panel.test",
    webhookUrl: "https://api.test/public/tienda/v1/webhooks/mercadopago"
};

export type TiendaMocks = {
    micorreo: MicorreoClient & {
        getToken: ReturnType<typeof vi.fn>;
        getRates: ReturnType<typeof vi.fn>;
    };
    paqar: PaqarClient & {
        auth: ReturnType<typeof vi.fn>;
        createOrder: ReturnType<typeof vi.fn>;
        createLabel: ReturnType<typeof vi.fn>;
        getTracking: ReturnType<typeof vi.fn>;
    };
    mp: MercadoPagoClient & {
        exchangeCode: ReturnType<typeof vi.fn>;
        refreshToken: ReturnType<typeof vi.fn>;
        getUser: ReturnType<typeof vi.fn>;
        createPreference: ReturnType<typeof vi.fn>;
        getPayment: ReturnType<typeof vi.fn>;
        refundPayment: ReturnType<typeof vi.fn>;
    };
};

export function crearMocks(): TiendaMocks {
    let preferencia = 0;

    const micorreo = {
        getToken: vi.fn(async () => ({
            token: "micorreo-token",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        })),
        getRates: vi.fn(async () => [{ costo: 3200, plazo: "3 a 5 días" }])
    };

    let envio = 0;
    let tracking = 0;

    const paqar = {
        auth: vi.fn(async () => undefined),
        createOrder: vi.fn(async () => {
            envio += 1;
            tracking += 1;
            return { shipmentId: `envio-${envio}`, trackingNumber: `track-${tracking}` };
        }),
        createLabel: vi.fn(async () => ({
            pdf: Buffer.from("%PDF-1.4 etiqueta de prueba"),
            url: null
        })),
        getTracking: vi.fn(async () => ({
            status: "en_transito",
            url: null,
            events: [
                {
                    status: "en_transito",
                    statusId: "1",
                    facility: "CABA",
                    date: new Date("2026-10-24T10:00:00.000-03:00"),
                    sign: null
                }
            ]
        }))
    };

    const mp = {
        exchangeCode: vi.fn(async () => ({
            accessToken: "mp-access-1",
            refreshToken: "mp-refresh-1",
            expiresIn: 3600,
            userId: "mp-user-1",
            clientId: "mp-app-1",
            scope: "offline_access"
        })),
        refreshToken: vi.fn(async () => ({
            accessToken: "mp-access-2",
            refreshToken: "mp-refresh-2",
            expiresIn: 3600,
            userId: "mp-user-1",
            clientId: "mp-app-1",
            scope: "offline_access"
        })),
        getUser: vi.fn(async () => ({
            id: "mp-user-1",
            alias: "Tienda Test",
            email: "mp-tienda@test.com"
        })),
        createPreference: vi.fn(async () => {
            preferencia += 1;
            return {
                id: `pref-${preferencia}`,
                initPoint: `https://mp-checkout.test/${preferencia}`
            };
        }),
        getPayment: vi.fn(),
        refundPayment: vi.fn(async () => ({ id: "refund-1" }))
    };

    return { micorreo, paqar, mp };
}

// Los tests disparan cientos de requests desde la misma IP.
const SIN_LIMITES = {
    ventanaMs: 60_000,
    requestsPorIp: Number.MAX_SAFE_INTEGER,
    ventanaPedidosMs: 60_000,
    pedidosPorIp: Number.MAX_SAFE_INTEGER
};

export type EntornoOverrides = {
    afipService?: AfipService;
    comprobanteService?: ComprobanteService;
    storage?: Storage;
};

export function crearEntorno(mocks = crearMocks(), overrides: EntornoOverrides = {}) {
    const container = createContainer({
        afipService: overrides.afipService ?? createMockAfipService(),
        comprobanteService: overrides.comprobanteService ?? createMockComprobanteService(),
        ...(overrides.storage ? { storage: overrides.storage } : {}),
        tienda: {
            micorreoClient: mocks.micorreo,
            paqarClient: mocks.paqar,
            mercadoPagoClient: mocks.mp,
            mercadoPagoConfig: MP_CONFIG,
            rateLimits: SIN_LIMITES
        }
    });

    return { app: createApp(container), container, mocks };
}

export async function login(app: Express, username = "libreria_sur"): Promise<string> {
    const res = await request(app)
        .post("/user/login")
        .send({ username, password: PASSWORD_SEED });

    return res.body.token;
}

export const auth = (req: request.Test, token: string) =>
    req.set("Authorization", `Bearer ${token}`);

export async function crearIntegracion(
    app: Express,
    token: string,
    nombre = "Tienda fase 2",
    origen = ORIGEN_TIENDA
) {
    const res = await auth(
        request(app).post("/integraciones").send({ nombre, origen }),
        token
    );

    return {
        id: res.body.data.integracion.id as number,
        apiKey: res.body.data.apiKey as string,
        origen
    };
}

export const publica = (app: Express, apiKey: string, origen = ORIGEN_TIENDA) => {
    const headers = (req: request.Test) =>
        req.set("X-API-Key", apiKey).set("Origin", origen);

    return {
        get: (path: string) => headers(request(app).get(path)),
        post: (path: string, idempotencyKey?: string) => {
            const req = headers(request(app).post(path));
            return idempotencyKey ? req.set("Idempotency-Key", idempotencyKey) : req;
        }
    };
};

export async function crearLibro(
    app: Express,
    token: string,
    isbnLibro: string,
    options: { precio?: number; pesoKg?: number | null; limite?: number } = {}
) {
    const res = await auth(
        request(app).post("/libro/").send({
            isbn: isbnLibro,
            titulo: `Libro tienda fase 2 ${isbnLibro}`,
            fecha_edicion: "2020-02-17",
            precio: options.precio ?? 12500,
            peso_kg: options.pesoKg === undefined ? 0.5 : options.pesoKg,
            stock_negativo_permitido: options.limite ?? 0
        }),
        token
    );

    return res.body.data as {
        id_libro: number;
        isbn: string;
        titulo: string;
        precio: number;
        peso_kg: number | null;
    };
}

export async function cargarStock(app: Express, token: string, isbnLibro: string, cantidad: number) {
    const depositos = await auth(request(app).get("/deposito/"), token);
    const principal = depositos.body.data.find((d: { principal: boolean }) => d.principal);

    return auth(
        request(app).post("/movimiento/").send({
            origen: { tipo: "exterior" },
            destino: { tipo: "deposito", id: principal.id },
            libros: [{ isbn: isbnLibro, cantidad }]
        }),
        token
    );
}

export const configuracionEnvios = {
    micorreo: {
        usuario: "micorreo-usuario",
        password: "micorreo-password",
        customerId: "customer-1"
    },
    paqar: {
        agreement: "agreement-1",
        apiKey: "paqar-api-key",
        sellerId: "seller-1"
    },
    origen: {
        calle: "Av. Siempre Viva",
        numero: "123",
        piso: "1",
        depto: "A",
        localidad: "CABA",
        provincia: "C",
        codigoPostal: "1425"
    },
    cajaDefault: { altoCm: 10, anchoCm: 15, largoCm: 20 },
    pesoPromedioKg: 0.5,
    formatoEtiqueta: "10x15",
    retiro: {
        activo: true,
        direccion: "Av. Retiro 123",
        horario: "Lunes a viernes de 9 a 18"
    }
};

export async function guardarConfiguracionEnvios(
    app: Express,
    token: string,
    overrides: Record<string, unknown> = {}
) {
    const res = await auth(
        request(app).put("/tienda/envios").send({ ...configuracionEnvios, ...overrides }),
        token
    );
    return res;
}

export async function conectarMercadoPago(app: Express, token: string): Promise<void> {
    // El seed de desarrollo conecta MercadoPago para `libreria_sur`; los tests
    // que necesitan ejercitar el OAuth parten de una cuenta desconectada.
    await auth(request(app).delete("/tienda/mercadopago"), token);

    const conectar = await auth(request(app).get("/tienda/mercadopago/conectar"), token);
    const url = new URL(conectar.body.data.url);

    await request(app)
        .get("/tienda/mercadopago/callback")
        .query({ code: "code-ok", state: url.searchParams.get("state") });
}

export async function userIdDe(username: string): Promise<number> {
    const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, username));
    return user.id;
}

export async function limpiarTienda(userId: number): Promise<void> {
    await db.delete(shippingConfigTable).where(eq(shippingConfigTable.user, userId));
    await db.delete(mercadoPagoTable).where(eq(mercadoPagoTable.user, userId));
}
