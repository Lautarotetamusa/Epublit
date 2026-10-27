import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from "../src/db/client";
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
const { app, container, mocks } = entorno;

const ISBN = isbn(9620);

let token: string;
let userId: number;
let otroUserId: number;
let apiKey: string;
let libroId: number;

const bodyPedido = {
    comprador: { nombre: "Comprador expiración", email: "expiracion@test.com" },
    entrega: { tipo: "retiro" as const },
    items: [{ isbn: ISBN, cantidad: 1 }],
    urlRetorno: `${ORIGEN_TIENDA}/retorno`
};

const crearPedido = async (key: string) => {
    const res = await publica(app, apiKey).post("/public/tienda/v1/pedidos", key).send(bodyPedido);
    expect(res.status).toBe(201);

    const [pedido] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.codigo, res.body.pedido.codigo));
    return pedido;
};

const vencerReserva = async (pedidoId: number) => {
    await db
        .update(reservationsTable)
        .set({ expira_en: new Date(Date.now() - 1000) })
        .where(eq(reservationsTable.pedido_id, pedidoId));
};

const historial = async (pedidoId: number) => {
    return db
        .select()
        .from(orderHistoryTable)
        .where(eq(orderHistoryTable.pedido_id, pedidoId));
};

const disponibilidad = async () => {
    const res = await request(app)
        .get(`/libro/${ISBN}`)
        .set("Authorization", `Bearer ${token}`);
    return res.body.data.disponible_principal as number;
};

const webhookAprobado = async (referencia: string, total: number, dataId: string) => {
    const requestId = `req-${dataId}`;
    const firma = signWebhook(MP_CONFIG.webhookSecret, dataId, requestId);

    mocks.mp.getPayment.mockResolvedValue({
        id: dataId,
        status: "approved",
        external_reference: referencia,
        transaction_amount: total,
        currency_id: "ARS",
        user_id: "mp-user-1"
    });

    return request(app)
        .post("/public/tienda/v1/webhooks/mercadopago")
        .query({ user_id: "mp-user-1" })
        .set("x-signature", firma)
        .set("x-request-id", requestId)
        .send({ type: "payment", data: { id: dataId } });
};

beforeAll(async () => {
    token = await login(app, "libreria_sur");
    userId = await userIdDe("libreria_sur");
    otroUserId = await userIdDe("editorial_norte");
    apiKey = (await crearIntegracion(app, token)).apiKey;

    const libro = await crearLibro(app, token, ISBN, { precio: 10000, pesoKg: 0.5 });
    libroId = libro.id_libro;
    await cargarStock(app, token, ISBN, 20);
    await guardarConfiguracionEnvios(app, token);
    await conectarMercadoPago(app, token);
});

afterAll(async () => {
    await limpiarTienda(userId);
    await limpiarTienda(otroUserId);
    db.$client.end();
});

describe("Expiración y cancelación", () => {
    it("expira a los 30 minutos, libera la reserva y es idempotente", async () => {
        const pedido = await crearPedido("expira-1");
        const conReserva = await disponibilidad();
        await vencerReserva(pedido.id);

        const expirados = await container.tienda.expirationService.expireOverdue();
        expect(expirados).toBeGreaterThanOrEqual(1);

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual).toMatchObject({ estado: "cancelado", estado_pago: "pendiente" });

        const reservas = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reservas.every((reserva) => reserva.estado === "liberada")).toBe(true);
        expect(await disponibilidad()).toBe(conReserva + 1);

        const hitos = await historial(pedido.id);
        expect(hitos.filter((hito) => hito.tipo === "pedido_cancelado")).toHaveLength(1);

        const segunda = await container.tienda.expirationService.expireOverdue();
        expect(segunda).toBe(0);
        expect((await historial(pedido.id)).filter((hito) => hito.tipo === "pedido_cancelado")).toHaveLength(1);
    });

    it("un pedido pagado o aceptado nunca expira", async () => {
        const pedido = await crearPedido("no-expira");
        await db
            .update(ordersTable)
            .set({ estado: "pagado", estado_pago: "aprobado" })
            .where(eq(ordersTable.id, pedido.id));
        await vencerReserva(pedido.id);

        const expirados = await container.tienda.expirationService.expireOverdue();
        expect(expirados).toBe(0);

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        expect(actual.estado).toBe("pagado");

        const [reserva] = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reserva.estado).toBe("activa");
    });

    it("cancela públicamente sólo un pedido pendiente de pago", async () => {
        const pedido = await crearPedido("cancela-publica");

        const res = await publica(app, apiKey)
            .post(`/public/tienda/v1/pedidos/${pedido.codigo}/cancelar`)
            .set("x-pedido-referencia", pedido.referencia_externa)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ estado: "cancelado", estadoPago: "pendiente" });

        const [reserva] = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reserva.estado).toBe("liberada");

        const repetida = await publica(app, apiKey)
            .post(`/public/tienda/v1/pedidos/${pedido.codigo}/cancelar`)
            .set("x-pedido-referencia", pedido.referencia_externa)
            .send({});
        expect(repetida.status).toBe(409);
        expect(repetida.body.error.codigo).toBe("transicion_invalida");
    });

    it("expiración y webhook compiten sin dejar estados inconsistentes", async () => {
        const pedido = await crearPedido("carrera");
        await vencerReserva(pedido.id);

        await Promise.all([
            container.tienda.expirationService.expireOverdue(),
            webhookAprobado(pedido.referencia_externa, pedido.total, "pay-race")
        ]);

        const [actual] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.id, pedido.id));
        const [reserva] = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        const [pago] = await db
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.pedido_id, pedido.id));

        if (actual.estado === "pagado") {
            expect(actual.estado_pago).toBe("aprobado");
            expect(reserva.estado).toBe("activa");
            expect(pago.estado).toBe("aprobado");
        } else {
            expect(actual.estado).toBe("cancelado");
            expect(reserva.estado).toBe("liberada");
            expect(["pendiente", "reembolsado", "aprobado"]).toContain(pago?.estado);
        }
        expect(libroId).toBeTypeOf("number");
    });
});
