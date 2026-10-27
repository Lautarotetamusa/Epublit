import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";

import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from "../src/db/client";
import { shippingConfigTable } from "../src/modules/tienda/shipping/shippingConfig.schema";
import {
    ORIGEN_TIENDA,
    crearEntorno,
    crearIntegracion,
    configuracionEnvios,
    guardarConfiguracionEnvios,
    limpiarTienda,
    login,
    publica,
    userIdDe
} from "./tiendaFase2.util";

const entorno = crearEntorno();
const { app, mocks } = entorno;

let token: string;
let otroToken: string;
let userId: number;
let otroUserId: number;
let apiKey: string;

beforeAll(async () => {
    token = await login(app, "libreria_sur");
    otroToken = await login(app, "editorial_norte");
    userId = await userIdDe("libreria_sur");
    otroUserId = await userIdDe("editorial_norte");
    apiKey = (await crearIntegracion(app, token)).apiKey;
});

afterAll(async () => {
    await limpiarTienda(userId);
    await limpiarTienda(otroUserId);
    db.$client.end();
});

describe("Configuración de envíos", () => {
    it("devuelve valores por defecto sin secretos", async () => {
        const res = await request(app)
            .get("/tienda/envios")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            micorreo: { usuario: null, customerId: null, configurado: false },
            paqar: { agreement: null, sellerId: null, configurado: false },
            cajaDefault: { altoCm: 10, anchoCm: 10, largoCm: 10 },
            pesoPromedioKg: null,
            formatoEtiqueta: "10x15",
            retiro: { activo: false, direccion: null, horario: null }
        });
        expect(JSON.stringify(res.body)).not.toContain("password");
    });

    it("guarda la configuración y cifra los secretos", async () => {
        const res = await guardarConfiguracionEnvios(app, token);

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            micorreo: {
                usuario: "micorreo-usuario",
                customerId: "customer-1",
                configurado: true
            },
            paqar: {
                agreement: "agreement-1",
                sellerId: "seller-1",
                configurado: true
            },
            origen: configuracionEnvios.origen,
            cajaDefault: configuracionEnvios.cajaDefault,
            pesoPromedioKg: 0.5,
            formatoEtiqueta: "10x15",
            retiro: configuracionEnvios.retiro
        });

        const [row] = await db
            .select()
            .from(shippingConfigTable)
            .where(eq(shippingConfigTable.user, userId));
        expect(row.micorreo_credencial_cifrada).not.toBe("micorreo-password");
        expect(row.paqar_api_key_cifrada).not.toBe("paqar-api-key");
        expect(row.micorreo_credencial_cifrada).toContain("v1:");
        expect(row.paqar_api_key_cifrada).toContain("v1:");
        expect(JSON.stringify(res.body)).not.toContain("micorreo-password");
        expect(JSON.stringify(res.body)).not.toContain("paqar-api-key");
    });

    it("omite los secretos del body y conserva los existentes", async () => {
        const [antes] = await db
            .select()
            .from(shippingConfigTable)
            .where(eq(shippingConfigTable.user, userId));

        const res = await request(app)
            .put("/tienda/envios")
            .set("Authorization", `Bearer ${token}`)
            .send({ micorreo: { usuario: "nuevo-usuario" }, paqar: { agreement: "nuevo-agreement" } });

        expect(res.status).toBe(200);
        expect(res.body.data.micorreo).toMatchObject({
            usuario: "nuevo-usuario",
            configurado: true
        });
        expect(res.body.data.paqar).toMatchObject({
            agreement: "nuevo-agreement",
            configurado: true
        });

        const [despues] = await db
            .select()
            .from(shippingConfigTable)
            .where(eq(shippingConfigTable.user, userId));
        expect(despues.micorreo_credencial_cifrada).toBe(antes.micorreo_credencial_cifrada);
        expect(despues.paqar_api_key_cifrada).toBe(antes.paqar_api_key_cifrada);
    });

    it.each([
        ["caja con alto 0", { cajaDefault: { altoCm: 0, anchoCm: 10, largoCm: 10 } }],
        ["peso 0", { pesoPromedioKg: 0 }],
        ["formato inválido", { formatoEtiqueta: "A4" }],
        ["retiro sin dirección", { retiro: { activo: true, direccion: "", horario: "9 a 18" } }]
    ])("rechaza %s", async (_caso, body) => {
        const res = await guardarConfiguracionEnvios(app, token, body);
        expect(res.status).toBe(400);
    });

    it("prueba MiCorreo con POST /token y PAQ.AR con GET /auth", async () => {
        mocks.micorreo.getToken.mockClear();
        mocks.paqar.auth.mockClear();

        const micorreo = await request(app)
            .post("/tienda/envios/probar")
            .set("Authorization", `Bearer ${token}`)
            .send({ api: "micorreo" });
        expect(micorreo.status).toBe(200);
        expect(micorreo.body).toEqual({
            api: "micorreo",
            ok: true,
            mensaje: "Conexión con MiCorreo correcta"
        });
        expect(mocks.micorreo.getToken).toHaveBeenCalledWith({
            usuario: "nuevo-usuario",
            password: "micorreo-password"
        });

        const paqar = await request(app)
            .post("/tienda/envios/probar")
            .set("Authorization", `Bearer ${token}`)
            .send({ api: "paqar" });
        expect(paqar.status).toBe(200);
        expect(paqar.body.ok).toBe(true);
        expect(mocks.paqar.auth).toHaveBeenCalled();
        expect(JSON.stringify([micorreo.body, paqar.body])).not.toContain("paqar-api-key");
    });

    it("devuelve 422 cuando el proveedor falla y 400 para un api desconocido", async () => {
        mocks.micorreo.getToken.mockRejectedValueOnce(new Error("boom"));
        mocks.paqar.auth.mockRejectedValueOnce(new Error("boom"));

        const micorreo = await request(app)
            .post("/tienda/envios/probar")
            .set("Authorization", `Bearer ${token}`)
            .send({ api: "micorreo" });
        expect(micorreo.status).toBe(422);
        expect(micorreo.body).toMatchObject({ api: "micorreo", ok: false });

        const paqar = await request(app)
            .post("/tienda/envios/probar")
            .set("Authorization", `Bearer ${token}`)
            .send({ api: "paqar" });
        expect(paqar.status).toBe(422);
        expect(paqar.body).toMatchObject({ api: "paqar", ok: false });

        const invalido = await request(app)
            .post("/tienda/envios/probar")
            .set("Authorization", `Bearer ${token}`)
            .send({ api: "otro" });
        expect(invalido.status).toBe(400);
    });

    it("la configuración pública marca envío disponible con ambas APIs configuradas", async () => {
        const res = await publica(app, apiKey, ORIGEN_TIENDA).get("/public/tienda/v1/config");

        expect(res.status).toBe(200);
        expect(res.body.envio).toEqual({ disponible: true });
        expect(res.body.mercadopago).toEqual({ disponible: false });
        expect(res.body.retiro).toEqual({
            disponible: true,
            direccion: "Av. Retiro 123",
            horario: "Lunes a viernes de 9 a 18"
        });
    });

    it("cada cuenta lee su propia configuración", async () => {
        const res = await request(app)
            .put("/tienda/envios")
            .set("Authorization", `Bearer ${otroToken}`)
            .send({
                ...configuracionEnvios,
                origen: {
                    ...configuracionEnvios.origen,
                    calle: "Calle ajena",
                    codigoPostal: "9999"
                },
                pesoPromedioKg: 0.8
            });
        expect(res.status).toBe(200);

        const propio = await request(app)
            .get("/tienda/envios")
            .set("Authorization", `Bearer ${token}`);
        const ajeno = await request(app)
            .get("/tienda/envios")
            .set("Authorization", `Bearer ${otroToken}`);

        expect(propio.body.data.origen.calle).toBe("Av. Siempre Viva");
        expect(ajeno.body.data.origen.calle).toBe("Calle ajena");
        expect(ajeno.body.data.pesoPromedioKg).toBeCloseTo(0.8, 3);
    });
});
