import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from "../src/db/client";
import { ExternalServiceError } from "../src/lib/http/errors";
import { isbn } from "../seeders/data";
import { paymentsTable } from "../src/modules/tienda/payment/payment.schema";
import { orderHistoryTable } from "../src/modules/tienda/order/orderHistory.schema";
import { ordersTable } from "../src/modules/tienda/order/order.schema";
import { reservationsTable } from "../src/modules/tienda/stock/reservation.schema";
import { signWebhook } from "../src/modules/tienda/payment/webhookSignature";
import {
    MP_CONFIG,
    ORIGEN_TIENDA,
    cargarStock,
    conectarMercadoPago,
    crearEntorno,
    crearIntegracion,
    crearLibro,
    guardarConfiguracionEnvios,
    limpiarTienda,
    login,
    publica,
    userIdDe
} from "./tiendaFase2.util";

const entorno = crearEntorno();
const { app, mocks } = entorno;

const ISBN = isbn(9610);

let token: string;
let otroToken: string;
let userId: number;
let otroUserId: number;
let apiKey: string;
let apiKeyAjeno: string;

const bodyPedido = {
    comprador: { nombre: "Comprador webhook", email: "webhook@test.com" },
    entrega: { tipo: "retiro" as const },
    items: [{ isbn: ISBN, cantidad: 1 }],
    urlRetorno: `${ORIGEN_TIENDA}/retorno`
};

const crearPedido = async (key: string) => {
    const res = await publica(app, apiKey).post("/public/tienda/v1/pedidos", key).send(bodyPedido);
    expect(res.status).toBe(201);
    const codigo = res.body.pedido.codigo as string;

    const [pedido] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.codigo, codigo));
    return pedido;
};

const pagoMock = (
    pedido: typeof ordersTable.$inferSelect,
    overrides: Record<string, unknown> = {}
) => ({
    id: "pay-1",
    status: "approved",
    external_reference: pedido.referencia_externa,
    transaction_amount: pedido.total,
    currency_id: "ARS",
    user_id: "mp-user-1",
    collector_id: "mp-user-1",
    date_approved: new Date().toISOString(),
    ...overrides
});

const enviarWebhook = async (options: {
    dataId: string;
    userId?: string;
    requestId?: string;
    firma?: string;
    type?: string;
}) => {
    const dataId = options.dataId;
    const requestId = options.requestId ?? `req-${dataId}`;
    const firma =
        options.firma ??
        signWebhook(MP_CONFIG.webhookSecret, dataId, requestId);

    return request(app)
        .post("/public/tienda/v1/webhooks/mercadopago")
        .query({ user_id: options.userId ?? "mp-user-1" })
        .set("x-signature", firma)
        .set("x-request-id", requestId)
        .send({ type: options.type ?? "payment", data: { id: dataId } });
};

const historial = async (pedidoId: number, tipo: string) => {
    const rows = await db
        .select()
        .from(orderHistoryTable)
        .where(eq(orderHistoryTable.pedido_id, pedidoId));
    return rows.filter((row) => row.tipo === tipo);
};

beforeAll(async () => {
    token = await login(app, "libreria_sur");
    otroToken = await login(app, "editorial_norte");
    userId = await userIdDe("libreria_sur");
    otroUserId = await userIdDe("editorial_norte");

    apiKey = (await crearIntegracion(app, token)).apiKey;
    apiKeyAjeno = (await crearIntegracion(app, otroToken, "Ajena", "https://tienda-ajena.test")).apiKey;

    await crearLibro(app, token, ISBN, { precio: 10000, pesoKg: 0.5 });
    await cargarStock(app, token, ISBN, 30);
    await guardarConfiguracionEnvios(app, token);
    await conectarMercadoPago(app, token);
});

afterAll(async () => {
    await limpiarTienda(userId);
    await limpiarTienda(otroUserId);
    db.$client.end();
});

describe("Webhook de MercadoPago", () => {
    it("rechaza una firma inválida sin modificar nada", async () => {
        const pedido = await crearPedido("wh-firma-invalida");
        mocks.mp.getPayment.mockResolvedValue(pagoMock(pedido, { id: "pay-invalid" }));

        const res = await enviarWebhook({
            dataId: "pay-invalid",
            firma: "ts=123,v1=deadbeef"
        });

        expect(res.status).toBe(401);
        expect(res.body.error.codigo).toBe("no_autenticado");

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual.estado).toBe("pendiente_pago");
    });

    it("ignora con 200 las notificaciones IPN legacy sin firma", async () => {
        const pedido = await crearPedido("wh-ipn-legacy");
        mocks.mp.getPayment.mockClear();

        const res = await request(app)
            .post("/public/tienda/v1/webhooks/mercadopago")
            .query({ topic: "payment", id: "pay-ipn", user_id: "mp-user-1" })
            .send({ resource: "pay-ipn", topic: "payment" });

        expect(res.status).toBe(200);
        expect(mocks.mp.getPayment).not.toHaveBeenCalled();

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual.estado).toBe("pendiente_pago");
    });

    it("rechaza un body inválido con 400 de validación", async () => {
        const dataId = "body-invalido";
        const requestId = "req-body-invalido";
        const firma = signWebhook(MP_CONFIG.webhookSecret, dataId, requestId);

        const res = await request(app)
            .post("/public/tienda/v1/webhooks/mercadopago")
            .query({ user_id: "mp-user-1" })
            .set("x-signature", firma)
            .set("x-request-id", requestId)
            .send({ type: "payment", data: "no-es-un-objeto" });

        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe("validacion");
    });

    it("rechaza un query inválido con 400 de validación", async () => {
        const dataId = "query-invalido";
        const requestId = "req-query-invalido";
        const firma = signWebhook(MP_CONFIG.webhookSecret, dataId, requestId);

        const res = await request(app)
            .post("/public/tienda/v1/webhooks/mercadopago")
            .query({ user_id: ["uno", "dos"] })
            .set("x-signature", firma)
            .set("x-request-id", requestId)
            .send({ type: "payment", data: { id: dataId } });

        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe("validacion");
    });

    it("responde 502 si MercadoPago devuelve un pago malformado", async () => {
        const pedido = await crearPedido("wh-malformado");
        mocks.mp.getPayment.mockRejectedValueOnce(
            new ExternalServiceError("MercadoPago", "respuesta inválida")
        );

        const res = await enviarWebhook({ dataId: "pay-malformado" });

        expect(res.status).toBe(502);
        expect(res.body.error.codigo).toBe("proveedor_no_disponible");

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual.estado).toBe("pendiente_pago");
    });

    it("rechaza una firma vencida", async () => {
        const pedido = await crearPedido("wh-firma-vencida");
        mocks.mp.getPayment.mockResolvedValue(pagoMock(pedido, { id: "pay-vencida" }));
        const firma = signWebhook(
            MP_CONFIG.webhookSecret,
            "pay-vencida",
            "req-vencida",
            Math.floor(Date.now() / 1000) - 3600
        );

        const res = await enviarWebhook({ dataId: "pay-vencida", requestId: "req-vencida", firma });
        expect(res.status).toBe(401);
    });

    it("aprueba el pago, pasa el pedido a pagado y es idempotente", async () => {
        const pedido = await crearPedido("wh-aprobado");
        mocks.mp.getPayment.mockResolvedValue(pagoMock(pedido));

        const primera = await enviarWebhook({ dataId: "pay-1", requestId: "req-aprobado" });
        expect(primera.status).toBe(200);

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual).toMatchObject({ estado: "pagado", estado_pago: "aprobado" });
        expect(await historial(pedido.id, "pago_aprobado")).toHaveLength(1);

        const [pago] = await db
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.pedido_id, pedido.id));
        expect(pago).toMatchObject({ pago_id: "pay-1", estado: "aprobado" });

        const repetida = await enviarWebhook({ dataId: "pay-1", requestId: "req-aprobado" });
        expect(repetida.status).toBe(200);
        expect(await historial(pedido.id, "pago_aprobado")).toHaveLength(1);
    });

    it("un pago rechazado deja el pedido pendiente y el intento rechazado", async () => {
        const pedido = await crearPedido("wh-rechazado");
        mocks.mp.getPayment.mockResolvedValue(
            pagoMock(pedido, { id: "pay-2", status: "rejected" })
        );

        const res = await enviarWebhook({ dataId: "pay-2" });
        expect(res.status).toBe(200);

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual.estado).toBe("pendiente_pago");
        expect(actual.estado_pago).toBe("rechazado");

        const [pago] = await db
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.pedido_id, pedido.id));
        expect(pago.estado).toBe("rechazado");
    });

    it("un reembolso confirma el pago y cancela el pedido si no estaba aceptado", async () => {
        const pedido = await crearPedido("wh-reembolso");
        mocks.mp.getPayment.mockResolvedValueOnce(pagoMock(pedido, { id: "pay-3" }));
        await enviarWebhook({ dataId: "pay-3" });

        mocks.mp.getPayment.mockResolvedValueOnce(
            pagoMock(pedido, { id: "pay-3", status: "refunded" })
        );
        const res = await enviarWebhook({ dataId: "pay-3", requestId: "req-reembolso" });
        expect(res.status).toBe(200);

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual).toMatchObject({ estado: "cancelado", estado_pago: "reembolsado" });

        const reservas = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reservas.every((reserva) => reserva.estado === "liberada")).toBe(true);
    });

    it("un importe que no coincide no modifica el pedido", async () => {
        const pedido = await crearPedido("wh-importe");
        mocks.mp.getPayment.mockResolvedValue(
            pagoMock(pedido, { id: "pay-4", transaction_amount: pedido.total + 100 })
        );

        const res = await enviarWebhook({ dataId: "pay-4" });

        expect(res.status).toBe(200);
        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual).toMatchObject({ estado: "pendiente_pago", estado_pago: "pendiente" });
    });

    it("un pago aprobado después de cancelar no reabre y dispara reembolso", async () => {
        const pedido = await crearPedido("wh-terminal");
        await publica(app, apiKey).post(`/public/tienda/v1/pedidos/${pedido.codigo}/cancelar`).set("x-pedido-referencia", pedido.referencia_externa).send({});

        mocks.mp.getPayment.mockResolvedValue(
            pagoMock(pedido, { id: "pay-5", status: "approved" })
        );
        mocks.mp.refundPayment.mockClear();

        const res = await enviarWebhook({ dataId: "pay-5" });

        expect(res.status).toBe(200);
        expect(mocks.mp.refundPayment).toHaveBeenCalledWith("mp-access-1", "pay-5");

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual.estado).toBe("cancelado");
        expect(actual.estado_pago).toBe("reembolsado");
    });

    it("ignora un pago cuyo vendedor no es la cuenta conectada", async () => {
        const pedido = await crearPedido("wh-otro-vendedor");
        mocks.mp.getPayment.mockResolvedValue(
            pagoMock(pedido, { id: "pay-otro-vendedor", collector_id: "mp-user-ajeno" })
        );

        const res = await enviarWebhook({ dataId: "pay-otro-vendedor" });

        expect(res.status).toBe(200);
        expect(res.body.ignorado).toBe("otro_vendedor");
        const [actual] = await db.select().from(ordersTable).where(eq(ordersTable.id, pedido.id));
        expect(actual.estado).toBe("pendiente_pago");
    });

    it("sin conexión para el user_id responde 409 para que MercadoPago reintente", async () => {
        const res = await enviarWebhook({ dataId: "pay-sin-conexion", userId: "mp-user-desconocido" });

        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("mercadopago_no_conectado");
    });

    it("reembolsa un segundo pago aprobado de un pedido ya pagado", async () => {
        const pedido = await crearPedido("wh-doble-pago");
        mocks.mp.getPayment.mockResolvedValueOnce(pagoMock(pedido, { id: "pay-doble-1" }));
        await enviarWebhook({ dataId: "pay-doble-1" });
        mocks.mp.refundPayment.mockClear();

        mocks.mp.getPayment.mockResolvedValueOnce(pagoMock(pedido, { id: "pay-doble-2" }));
        const res = await enviarWebhook({ dataId: "pay-doble-2" });

        expect(res.status).toBe(200);
        expect(mocks.mp.refundPayment).toHaveBeenCalledWith("mp-access-1", "pay-doble-2");
        const [actual] = await db.select().from(ordersTable).where(eq(ordersTable.id, pedido.id));
        expect(actual).toMatchObject({ estado: "pagado", estado_pago: "aprobado" });
        const pagos = await db.select().from(paymentsTable).where(eq(paymentsTable.pedido_id, pedido.id));
        expect(pagos.find((p) => p.pago_id === "pay-doble-1")?.estado).toBe("aprobado");
        expect(pagos.find((p) => p.pago_id === "pay-doble-2")?.estado).toBe("reembolsado");
    });

    it("un pago de otra cuenta no modifica el pedido", async () => {
        const pedido = await crearPedido("wh-otra-cuenta");
        mocks.mp.getPayment.mockResolvedValue(pagoMock(pedido, { id: "pay-6" }));
        await enviarWebhook({ dataId: "pay-6" });

        const [antes] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));

        mocks.mp.exchangeCode.mockResolvedValueOnce({
            accessToken: "mp-access-otro",
            refreshToken: "mp-refresh-otro",
            expiresIn: 3600,
            userId: "mp-user-2",
            clientId: "mp-app-1",
            scope: "offline_access"
        });
        const conectar = await request(app)
            .get("/tienda/mercadopago/conectar")
            .set("Authorization", `Bearer ${otroToken}`);
        const url = new URL(conectar.body.data.url);
        await request(app)
            .get("/tienda/mercadopago/callback")
            .query({ code: "code-otro", state: url.searchParams.get("state") });

        const res = await enviarWebhook({ dataId: "pay-6", userId: "mp-user-2" });
        expect(res.status).toBe(200);

        const [despues] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(despues.estado).toBe(antes.estado);
        expect(despues.estado_pago).toBe(antes.estado_pago);
        expect(apiKeyAjeno).toBeTruthy();
    });
});
