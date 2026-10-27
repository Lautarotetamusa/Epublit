import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from "../src/db/client";
import { ExternalServiceError } from "../src/lib/http/errors";
import { mercadoPagoTable } from "../src/modules/tienda/payment/mercadopago.schema";
import {
    MP_CONFIG,
    crearEntorno,
    limpiarTienda,
    login,
    userIdDe
} from "./tiendaFase2.util";

const entorno = crearEntorno();
const { app, container, mocks } = entorno;

let token: string;
let otroToken: string;
let userId: number;
let otroUserId: number;

const auth = (req: request.Test, t = token) => req.set("Authorization", `Bearer ${t}`);

const urlConectar = async (t = token): Promise<URL> => {
    const res = await auth(request(app).get("/tienda/mercadopago/conectar"), t);
    expect(res.status).toBe(200);
    return new URL(res.body.data.url);
};

const callback = (state: string, code = "code-ok") =>
    request(app).get("/tienda/mercadopago/callback").query({ state, code });

beforeAll(async () => {
    token = await login(app, "libreria_sur");
    otroToken = await login(app, "editorial_norte");
    userId = await userIdDe("libreria_sur");
    otroUserId = await userIdDe("editorial_norte");

    // El seed deja MercadoPago conectado para `libreria_sur`; esta suite
    // prueba el flujo OAuth desde cero.
    await limpiarTienda(userId);
    await limpiarTienda(otroUserId);
});

afterAll(async () => {
    await limpiarTienda(userId);
    await limpiarTienda(otroUserId);
    db.$client.end();
});

describe("OAuth de MercadoPago", () => {
    it("arranca desconectado", async () => {
        const res = await auth(request(app).get("/tienda/mercadopago"));

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ conectado: false });
    });

    it("devuelve la URL de autorización con state y scope", async () => {
        const url = await urlConectar();

        expect(url.origin).toBe(MP_CONFIG.authBaseUrl);
        expect(url.pathname).toBe("/authorization");
        expect(url.searchParams.get("client_id")).toBe(MP_CONFIG.clientId);
        expect(url.searchParams.get("response_type")).toBe("code");
        expect(url.searchParams.get("platform_id")).toBe("mp");
        expect(url.searchParams.get("scope")).toBe("offline_access");
        expect(url.searchParams.get("redirect_uri")).toBe(MP_CONFIG.redirectUri);
        expect(url.searchParams.get("state")).toBeTruthy();
    });

    it("rechaza un state o código inválido sin crear conexión", async () => {
        const invalido = await callback("state-invalido");
        expect(invalido.status).toBe(400);

        const url = await urlConectar();
        const sinCodigo = await request(app)
            .get("/tienda/mercadopago/callback")
            .query({ state: url.searchParams.get("state") });
        expect(sinCodigo.status).toBe(400);

        const estado = await auth(request(app).get("/tienda/mercadopago"));
        expect(estado.body.data.conectado).toBe(false);
    });

    it("responde 502 con el error del proveedor si MercadoPago rechaza el código", async () => {
        mocks.mp.exchangeCode.mockRejectedValueOnce(
            new ExternalServiceError("MercadoPago", "MercadoPago respondió 400", 400, { error: "invalid_client" })
        );

        const url = await urlConectar();
        const res = await callback(url.searchParams.get("state")!);

        expect(res.status).toBe(502);
        expect(res.body.errors[0]).toEqual({ code: "BadGateway", message: "MercadoPago respondió 400" });

        const estado = await auth(request(app).get("/tienda/mercadopago"));
        expect(estado.body.data.conectado).toBe(false);
    });

    it("intercambia el código, guarda tokens cifrados y redirige al panel", async () => {
        const url = await urlConectar();
        const res = await callback(url.searchParams.get("state")!);

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("https://panel.test/tienda?mercadopago=conectado");

        const estado = await auth(request(app).get("/tienda/mercadopago"));
        expect(estado.body.data).toMatchObject({
            conectado: true,
            alias: "Tienda Test",
            email: "mp-tienda@test.com",
            aplicacionId: "mp-app-1"
        });
        expect(JSON.stringify(estado.body)).not.toMatch(/access|refresh|token/i);

        const [row] = await db
            .select()
            .from(mercadoPagoTable)
            .where(eq(mercadoPagoTable.user, userId));
        expect(row.access_token_cifrado).not.toBe("mp-access-1");
        expect(row.access_token_cifrado).toContain("v1:");
        expect(row.refresh_token_cifrado).toContain("v1:");
    });

    it("no permite conectar dos veces la misma cuenta", async () => {
        const res = await auth(request(app).get("/tienda/mercadopago/conectar"));
        expect(res.status).toBe(409);
    });

    it("no permite que el mismo usuario de MercadoPago quede en otra cuenta", async () => {
        const url = await urlConectar(otroToken);
        const res = await callback(url.searchParams.get("state")!);

        expect(res.status).toBe(409);

        const [rows] = await db
            .select({ id: mercadoPagoTable.id })
            .from(mercadoPagoTable)
            .where(eq(mercadoPagoTable.user, otroUserId));
        expect(rows).toBeUndefined();
    });

    it("desconecta borrando los tokens", async () => {
        const res = await auth(request(app).delete("/tienda/mercadopago"));

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ conectado: false });

        const estado = await auth(request(app).get("/tienda/mercadopago"));
        expect(estado.body.data.conectado).toBe(false);

        const rows = await db
            .select()
            .from(mercadoPagoTable)
            .where(eq(mercadoPagoTable.user, userId));
        expect(rows).toHaveLength(0);
    });

    it("renueva el access token vencido y rota el refresh token", async () => {
        const url = await urlConectar();
        await callback(url.searchParams.get("state")!);

        await db
            .update(mercadoPagoTable)
            .set({ vencimiento: new Date(Date.now() - 1000) })
            .where(eq(mercadoPagoTable.user, userId));

        const access = await container.tienda.mercadoPagoService.getAccessToken(userId);
        expect(access).toBe("mp-access-2");
        expect(mocks.mp.refreshToken).toHaveBeenCalledWith("mp-refresh-1");

        const [row] = await db
            .select()
            .from(mercadoPagoTable)
            .where(eq(mercadoPagoTable.user, userId));
        expect(row.access_token_cifrado).not.toBe("mp-access-2");
    });

    it("si MercadoPago no responde al refrescar, conserva la conexión y devuelve 502", async () => {
        await db
            .update(mercadoPagoTable)
            .set({ vencimiento: new Date(Date.now() - 1000) })
            .where(eq(mercadoPagoTable.user, userId));
        mocks.mp.refreshToken.mockRejectedValueOnce(
            new ExternalServiceError("MercadoPago", "No se pudo conectar con MercadoPago")
        );

        await expect(container.tienda.mercadoPagoService.getAccessToken(userId)).rejects.toMatchObject({
            status: 502,
            codigo: "proveedor_no_disponible"
        });

        const estado = await auth(request(app).get("/tienda/mercadopago"));
        expect(estado.body.data.conectado).toBe(true);
    });

    it("refrescos concurrentes usan el refresh token una sola vez", async () => {
        await db
            .update(mercadoPagoTable)
            .set({ vencimiento: new Date(Date.now() - 1000) })
            .where(eq(mercadoPagoTable.user, userId));
        mocks.mp.refreshToken.mockClear();

        await Promise.all([
            container.tienda.mercadoPagoService.getAccessToken(userId),
            container.tienda.mercadoPagoService.getAccessToken(userId)
        ]);

        expect(mocks.mp.refreshToken).toHaveBeenCalledTimes(1);
    });

    it("si MercadoPago rechaza el refresh token, desconecta y devuelve 409", async () => {
        await db
            .update(mercadoPagoTable)
            .set({ vencimiento: new Date(Date.now() - 1000) })
            .where(eq(mercadoPagoTable.user, userId));
        mocks.mp.refreshToken.mockRejectedValueOnce(
            new ExternalServiceError("MercadoPago", "MercadoPago respondió 400", 400, { error: "invalid_grant" })
        );

        await expect(container.tienda.mercadoPagoService.getAccessToken(userId)).rejects.toMatchObject({
            status: 409,
            codigo: "mercadopago_no_conectado"
        });

        const estado = await auth(request(app).get("/tienda/mercadopago"));
        expect(estado.body.data.conectado).toBe(false);
    });
});
