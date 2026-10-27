import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";

import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from "../src/db/client";
import { isbn } from "../seeders/data";
import { paymentsTable } from "../src/modules/tienda/payment/payment.schema";
import { orderItemsTable } from "../src/modules/tienda/order/orderItem.schema";
import { ordersTable } from "../src/modules/tienda/order/order.schema";
import { reservationsTable } from "../src/modules/tienda/stock/reservation.schema";
import {
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

const ISBN = isbn(9600);
const ISBN_SIN_STOCK = isbn(9601);
const ISBN_SIN_PESO = isbn(9602);
const ISBN_AJENO = isbn(9603);

let token: string;
let otroToken: string;
let userId: number;
let otroUserId: number;
let apiKey: string;
let apiKeyAjeno: string;
let libro: { id_libro: number; isbn: string; titulo: string; precio: number };
let libroSinStock: { id_libro: number; isbn: string; titulo: string; precio: number };

const clave = (sufijo: string) => `test-${sufijo}-${Date.now()}`;

const bodyPedido = (overrides: Record<string, unknown> = {}) => ({
    comprador: {
        nombre: "Ana Pérez",
        email: "ana@test.com",
        telefono: "1122334455",
        documento: "20123456"
    },
    entrega: {
        tipo: "envio",
        direccion: {
            calle: "Av. Corrientes",
            numero: "1234",
            piso: "2",
            depto: "B",
            localidad: "CABA",
            provincia: "C",
            codigoPostal: "1043"
        }
    },
    items: [{ isbn: ISBN, cantidad: 1 }],
    urlRetorno: `${ORIGEN_TIENDA}/checkout/retorno`,
    ...overrides
});

const crear = (body: unknown, key: string, keyApi = apiKey) =>
    publica(app, keyApi, ORIGEN_TIENDA).post("/public/tienda/v1/pedidos", key).send(body as object);

const contarPedidos = async (claveIdempotencia: string) => {
    const rows = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.clave_idempotencia, claveIdempotencia));
    return rows.length;
};

const contarReservas = async (pedidoId: number) => {
    const rows = await db
        .select({ id: reservationsTable.id })
        .from(reservationsTable)
        .where(eq(reservationsTable.pedido_id, pedidoId));
    return rows.length;
};

const contarPagos = async (pedidoId: number) => {
    const rows = await db
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(eq(paymentsTable.pedido_id, pedidoId));
    return rows.length;
};

beforeAll(async () => {
    token = await login(app, "libreria_sur");
    otroToken = await login(app, "editorial_norte");
    userId = await userIdDe("libreria_sur");
    otroUserId = await userIdDe("editorial_norte");

    const integracion = await crearIntegracion(app, token);
    apiKey = integracion.apiKey;

    const ajeno = await crearIntegracion(app, otroToken, "Ajena", "https://tienda-ajena.test");
    apiKeyAjeno = ajeno.apiKey;

    libro = await crearLibro(app, token, ISBN, { precio: 10000, pesoKg: 0.5 });
    libroSinStock = await crearLibro(app, token, ISBN_SIN_STOCK, { precio: 10000, pesoKg: 0.5 });
    await crearLibro(app, otroToken, ISBN_AJENO, { precio: 10000, pesoKg: 0.5 });
    const sinPeso = await crearLibro(app, otroToken, ISBN_SIN_PESO, { precio: 10000, pesoKg: null });

    await cargarStock(app, token, ISBN, 30);
    await cargarStock(app, otroToken, ISBN_SIN_PESO, 10);
    await cargarStock(app, otroToken, ISBN_AJENO, 10);

    await guardarConfiguracionEnvios(app, token);
    await conectarMercadoPago(app, token);

    expect(libroSinStock.id_libro).toBeTypeOf("number");
    expect(sinPeso.id_libro).toBeTypeOf("number");
});

afterAll(async () => {
    await limpiarTienda(userId);
    await limpiarTienda(otroUserId);
    db.$client.end();
});

describe("Cotización", () => {
    it("cotiza con MiCorreo /rates y devuelve retiro", async () => {
        mocks.micorreo.getToken.mockClear();
        mocks.micorreo.getRates.mockClear();

        const res = await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN, cantidad: 2 }],
            entrega: {
                tipo: "envio",
                codigoPostal: "1043",
                localidad: "CABA",
                provincia: "C"
            }
        });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            subtotal: 20000,
            envio: { disponible: true, costo: 3200, plazo: "3 a 5 días" },
            retiro: {
                disponible: true,
                direccion: "Av. Retiro 123",
                horario: "Lunes a viernes de 9 a 18"
            }
        });
        expect(res.body.items[0]).toMatchObject({
            isbn: ISBN,
            cantidad: 2,
            precioUnitario: 10000,
            subtotal: 20000
        });
        expect(mocks.micorreo.getRates).toHaveBeenCalledWith(
            "micorreo-token",
            expect.objectContaining({
                postalCodeOrigin: "1425",
                postalCodeDestination: "1043",
                deliveredType: "D",
                dimensions: { weight: 1000, height: 10, width: 15, length: 20 }
            })
        );
    });

    it("cachea el token de MiCorreo entre cotizaciones", async () => {
        const llamadas = mocks.micorreo.getToken.mock.calls.length;

        await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN, cantidad: 1 }],
            entrega: { tipo: "envio", codigoPostal: "1043", localidad: "CABA", provincia: "C" }
        });

        expect(mocks.micorreo.getToken.mock.calls).toHaveLength(llamadas);
    });

    it("cotiza retiro sin exigir código postal", async () => {
        const res = await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN, cantidad: 1 }],
            entrega: { tipo: "retiro" }
        });

        expect(res.status).toBe(200);
        expect(res.body.retiro.disponible).toBe(true);
        expect(res.body.envio).toMatchObject({ disponible: false, motivo: "retiro_seleccionado" });
    });

    it("exige destino completo para envío", async () => {
        const res = await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN, cantidad: 1 }],
            entrega: { tipo: "envio", codigoPostal: "1043" }
        });

        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe("validacion");
    });

    it("rechaza un ISBN de otra cuenta sin revelar datos", async () => {
        const res = await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN_AJENO, cantidad: 1 }],
            entrega: { tipo: "retiro" }
        });

        expect(res.status).toBe(404);
        expect(res.body.error.codigo).toBe("no_encontrado");
    });

    it("devuelve 409 con detalle si no alcanza el stock", async () => {
        const res = await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN_SIN_STOCK, cantidad: 1 }],
            entrega: { tipo: "retiro" }
        });

        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("stock_insuficiente");
        expect(res.body.error.detalles[0]).toMatchObject({ isbn: ISBN_SIN_STOCK, pedido: 1, disponible: 0 });
    });

    it("no reserva ni crea pedidos al cotizar", async () => {
        const antes = await db
            .select({ id: ordersTable.id })
            .from(ordersTable)
            .where(eq(ordersTable.user, userId));

        await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN, cantidad: 1 }],
            entrega: { tipo: "retiro" }
        });

        const despues = await db
            .select({ id: ordersTable.id })
            .from(ordersTable)
            .where(eq(ordersTable.user, userId));
        expect(despues).toHaveLength(antes.length);
    });
});

describe("Creación de pedidos", () => {
    it("exige Idempotency-Key", async () => {
        const res = await publica(app, apiKey).post("/public/tienda/v1/pedidos").send(bodyPedido());

        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe("validacion");
    });

    it("crea el pedido, reserva stock y genera la preferencia", async () => {
        const key = clave("valido");
        mocks.mp.createPreference.mockClear();

        const res = await crear(bodyPedido(), key);

        expect(res.status).toBe(201);
        expect(res.body.pedido).toMatchObject({
            estado: "pendiente_pago",
            estadoPago: "pendiente",
            subtotal: 10000,
            costoEnvio: 3200,
            total: 13200,
            entrega: {
                tipo: "envio",
                direccion: {
                    calle: "Av. Corrientes",
                    codigoPostal: "1043"
                }
            },
            pago: {
                proveedor: "mercadopago",
                estado: "pendiente",
                preferenciaId: "pref-1"
            }
        });
        expect(res.body.pedido.codigo).toMatch(/^PED-\d{4}-\d{6}$/);
        expect(JSON.stringify(res.body)).not.toMatch(/venta|comprobante|referencia_externa/i);

        const [pedido] = await db
            .select()
            .from(ordersTable)
            .where(and(eq(ordersTable.user, userId), eq(ordersTable.codigo, res.body.pedido.codigo)));
        expect(pedido.estado).toBe("pendiente_pago");
        expect(pedido.peso_kg).toBeCloseTo(0.5, 3);
        expect(pedido.caja_alto_cm).toBe(10);
        expect(await contarReservas(pedido.id)).toBe(1);
        expect(await contarPagos(pedido.id)).toBe(1);

        const items = await db
            .select()
            .from(orderItemsTable)
            .where(eq(orderItemsTable.pedido_id, pedido.id));
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ isbn: ISBN, cantidad: 1, precio_unitario: 10000 });

        const [pago] = await db.select().from(paymentsTable).where(eq(paymentsTable.pedido_id, pedido.id));
        expect(pago.init_point).toBe("https://mp-checkout.test/1");
        expect(pago.vence_en).toBeInstanceOf(Date);

        const preferencia = mocks.mp.createPreference.mock.calls.at(-1)![1] as Record<string, unknown>;
        expect(preferencia.external_reference).toBe(pedido.referencia_externa);
        expect(preferencia.notification_url).toContain("user_id=mp-user-1");
        expect(preferencia.auto_return).toBe("approved");
        expect(preferencia.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ title: "Envío", unit_price: 3200 }),
                expect.objectContaining({ title: libro.titulo, unit_price: 10000 })
            ])
        );

        const despues = await request(app)
            .get(`/libro/${ISBN}`)
            .set("Authorization", `Bearer ${token}`);
        expect(despues.body.data.disponible_principal).toBe(29);
    });

    it("repite la misma clave y cuerpo sin duplicar pedido, reserva ni preferencia", async () => {
        const key = "replay-fijo";
        const primera = await crear(bodyPedido(), key);
        expect(primera.status).toBe(201);
        const llamadas = mocks.mp.createPreference.mock.calls.length;

        const segunda = await crear(bodyPedido(), key);

        expect(segunda.status).toBe(200);
        expect(segunda.body.pedido.codigo).toBe(primera.body.pedido.codigo);
        expect(await contarPedidos(key)).toBe(1);
        expect(mocks.mp.createPreference.mock.calls).toHaveLength(llamadas);
    });

    it("dos requests concurrentes con la misma clave producen un solo pedido", async () => {
        const key = clave("concurrente");
        const [primera, segunda] = await Promise.all([crear(bodyPedido(), key), crear(bodyPedido(), key)]);

        const codigos = [primera.body.pedido.codigo, segunda.body.pedido.codigo];
        expect(codigos[0]).toBe(codigos[1]);
        expect(await contarPedidos(key)).toBe(1);

        const [pedido] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.clave_idempotencia, key));
        expect(await contarReservas(pedido.id)).toBe(1);
        expect(await contarPagos(pedido.id)).toBe(1);
    });

    it("rechaza la misma clave con otro cuerpo", async () => {
        const key = "conflicto-cuerpo";
        await crear(bodyPedido(), key);

        const res = await crear(bodyPedido({ items: [{ isbn: ISBN, cantidad: 2 }] }), key);

        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("idempotencia_conflicto");
        expect(await contarPedidos(key)).toBe(1);
    });

    it("la misma clave en otra integración produce otro pedido", async () => {
        const key = "misma-clave-otra-integracion";
        const primera = await crear(bodyPedido(), key);
        const segunda = await crear(bodyPedido(), key, (
            await crearIntegracion(app, token, "Otra más", ORIGEN_TIENDA)
        ).apiKey);

        expect(primera.status).toBe(201);
        expect(segunda.status).toBe(201);
        expect(segunda.body.pedido.codigo).not.toBe(primera.body.pedido.codigo);
        expect(await contarPedidos(key)).toBe(2);
    });

    it("rechaza urlRetorno de otro origen", async () => {
        const key = clave("url-ajena");
        const res = await crear(bodyPedido({ urlRetorno: "https://otro-origen.test/retorno" }), key);

        expect(res.status).toBe(400);
        expect(await contarPedidos(key)).toBe(0);
    });

    it("crea pedidos de retiro con snapshot y sin costo de envío", async () => {
        const key = clave("retiro");
        const res = await crear(
            bodyPedido({
                comprador: { nombre: "Luis", email: "luis@test.com" },
                entrega: { tipo: "retiro" }
            }),
            key
        );

        expect(res.status).toBe(201);
        expect(res.body.pedido).toMatchObject({
            costoEnvio: 0,
            total: 10000,
            entrega: {
                tipo: "retiro",
                direccion: "Av. Retiro 123",
                horario: "Lunes a viernes de 9 a 18"
            }
        });
        const preferencia = mocks.mp.createPreference.mock.calls.at(-1)![1] as {
            items: unknown[];
        };
        expect(preferencia.items).toHaveLength(1);
    });

    it("si no hay stock no queda pedido ni reserva", async () => {
        const key = clave("sin-stock");
        const res = await crear(
            bodyPedido({ items: [{ isbn: ISBN_SIN_STOCK, cantidad: 1 }] }),
            key
        );

        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("stock_insuficiente");
        expect(await contarPedidos(key)).toBe(0);
    });

    it("si falla la preferencia, reintentar con la misma clave genera el link", async () => {
        const key = clave("pref-falla");
        mocks.mp.createPreference.mockRejectedValueOnce(new Error("MP caído"));

        const res = await crear(bodyPedido(), key);

        expect(res.status).toBe(502);
        expect(res.body.error.codigo).toBe("proveedor_no_disponible");
        expect(await contarPedidos(key)).toBe(1);

        const reintento = await crear(bodyPedido(), key);

        expect(reintento.status).toBe(200);
        expect(reintento.body.pedido.pago).toMatchObject({ estado: "pendiente" });
        expect(reintento.body.pedido.pago.initPoint).toBeTruthy();
        expect(await contarPedidos(key)).toBe(1);
    });

    it("si MiCorreo falla al cotizar no deja pedido ni reserva", async () => {
        const key = clave("cotizacion-falla");
        mocks.micorreo.getRates.mockRejectedValueOnce(new Error("MiCorreo caído"));

        const res = await crear(bodyPedido(), key);

        expect(res.status).toBe(502);
        expect(res.body.error.codigo).toBe("proveedor_no_disponible");
        expect(await contarPedidos(key)).toBe(0);
    });

    it("permite consultar el pedido público sin datos internos", async () => {
        const key = clave("detalle");
        const creado = await crear(bodyPedido(), key);
        const res = await publica(app, apiKey)
            .get(`/public/tienda/v1/pedidos/${creado.body.pedido.codigo}`)
            .set("x-pedido-referencia", creado.body.pedido.referencia);

        expect(res.status).toBe(200);
        expect(res.body.codigo).toBe(creado.body.pedido.codigo);
        expect(res.body.items).toHaveLength(1);
        expect(JSON.stringify(res.body)).not.toMatch(/venta_id|comprobante|referencia_externa|url_retorno/i);
    });

    it("un pedido de otra cuenta devuelve 404", async () => {
        const key = clave("ajeno");
        const creado = await crear(bodyPedido(), key);

        const res = await publica(app, apiKeyAjeno, "https://tienda-ajena.test")
            .get(`/public/tienda/v1/pedidos/${creado.body.pedido.codigo}`)
            .set("x-pedido-referencia", creado.body.pedido.referencia);

        expect(res.status).toBe(404);
        expect(res.body.error.codigo).toBe("no_encontrado");
    });
});

describe("Acceso del comprador al pedido", () => {
    it("sin la referencia del pedido o con una incorrecta responde 404", async () => {
        const creado = await crear(bodyPedido(), clave("sin-referencia"));
        const ruta = `/public/tienda/v1/pedidos/${creado.body.pedido.codigo}`;

        const sinReferencia = await publica(app, apiKey).get(ruta);
        const incorrecta = await publica(app, apiKey)
            .get(ruta)
            .set("x-pedido-referencia", "00000000-0000-0000-0000-000000000000");
        const cancelar = await publica(app, apiKey).post(`${ruta}/cancelar`).send({});

        expect(sinReferencia.status).toBe(404);
        expect(incorrecta.status).toBe(404);
        expect(cancelar.status).toBe(404);

        const [pedido] = await db.select().from(ordersTable).where(eq(ordersTable.codigo, creado.body.pedido.codigo));
        expect(pedido.estado).toBe("pendiente_pago");
    });
});

describe("Regeneración de preferencia", () => {
    it("reutiliza la preferencia pendiente vigente", async () => {
        const creado = await crear(bodyPedido(), clave("regen-vigente"));
        const codigo = creado.body.pedido.codigo;
        const preferencia = creado.body.pedido.pago.preferenciaId;

        const res = await publica(app, apiKey)
            .post(`/public/tienda/v1/pedidos/${codigo}/pago`)
            .set("x-pedido-referencia", creado.body.pedido.referencia)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.pago).toMatchObject({ preferenciaId: preferencia, estado: "pendiente" });
    });

    it("genera una nueva preferencia si el pago anterior fue rechazado", async () => {
        const creado = await crear(bodyPedido(), clave("regen-rechazado"));
        const codigo = creado.body.pedido.codigo;
        const [pedido] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.codigo, codigo));
        const anterior = await db
            .select()
            .from(paymentsTable)
            .where(eq(paymentsTable.pedido_id, pedido.id));
        await db
            .update(paymentsTable)
            .set({ estado: "rechazado" })
            .where(eq(paymentsTable.id, anterior[0].id));

        const res = await publica(app, apiKey)
            .post(`/public/tienda/v1/pedidos/${codigo}/pago`)
            .set("x-pedido-referencia", creado.body.pedido.referencia)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.pago.preferenciaId).not.toBe(creado.body.pedido.pago.preferenciaId);
        expect(await contarPagos(pedido.id)).toBe(2);
        expect(await contarReservas(pedido.id)).toBe(1);
    });

    it("no genera preferencia si la reserva expiró", async () => {
        const creado = await crear(bodyPedido(), clave("regen-expirada"));
        const codigo = creado.body.pedido.codigo;
        const [pedido] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.codigo, codigo));
        await db
            .update(reservationsTable)
            .set({ expira_en: new Date(Date.now() - 1000) })
            .where(eq(reservationsTable.pedido_id, pedido.id));

        const res = await publica(app, apiKey)
            .post(`/public/tienda/v1/pedidos/${codigo}/pago`)
            .set("x-pedido-referencia", creado.body.pedido.referencia)
            .send({});

        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("transicion_invalida");
    });
});

describe("Cancelación pública y errores de checkout", () => {
    it("cancela un pedido pendiente y libera la reserva", async () => {
        const antes = await publica(app, apiKey).post("/public/tienda/v1/cotizar").send({
            items: [{ isbn: ISBN, cantidad: 1 }],
            entrega: { tipo: "retiro" }
        });
        const disponibilidadAntes = antes.body.retiro.disponible;

        const creado = await crear(bodyPedido(), clave("cancelar"));
        const codigo = creado.body.pedido.codigo;

        const res = await publica(app, apiKey)
            .post(`/public/tienda/v1/pedidos/${codigo}/cancelar`)
            .set("x-pedido-referencia", creado.body.pedido.referencia)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.estado).toBe("cancelado");
        expect(res.body.estadoPago).toBe("pendiente");

        const [pedido] = await db
            .select()
            .from(ordersTable)
            .where(eq(ordersTable.codigo, codigo));
        const reservas = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reservas.every((r) => r.estado === "liberada")).toBe(true);

        const repetida = await publica(app, apiKey)
            .post(`/public/tienda/v1/pedidos/${codigo}/cancelar`)
            .set("x-pedido-referencia", creado.body.pedido.referencia)
            .send({});
        expect(repetida.status).toBe(409);
        expect(disponibilidadAntes).toBe(true);
    });

    it("sin MercadoPago conectado devuelve 409 y no deja pedido", async () => {
        await request(app)
            .delete("/tienda/mercadopago")
            .set("Authorization", `Bearer ${token}`);

        const key = clave("sin-mp");
        const res = await crear(bodyPedido(), key);

        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("mercadopago_no_conectado");
        expect(await contarPedidos(key)).toBe(0);
    });

    it("con correo no configurado devuelve 422 y no deja pedido", async () => {
        const key = clave("sin-correo");
        const res = await publica(app, apiKeyAjeno, "https://tienda-ajena.test")
            .post("/public/tienda/v1/pedidos", key)
            .send(
                bodyPedido({
                    items: [{ isbn: ISBN_AJENO, cantidad: 1 }],
                    urlRetorno: "https://tienda-ajena.test/checkout/retorno"
                })
            );

        expect(res.status).toBe(422);
        expect(res.body.error.codigo).toBe("correo_no_configurado");
    });

    it("con peso faltante devuelve 422 y no deja pedido", async () => {
        const guardar = await guardarConfiguracionEnvios(app, otroToken, { pesoPromedioKg: null });
        expect(guardar.status).toBe(200);

        const key = clave("sin-peso");
        const res = await publica(app, apiKeyAjeno, "https://tienda-ajena.test")
            .post("/public/tienda/v1/pedidos", key)
            .set("Idempotency-Key", key)
            .send(
                bodyPedido({
                    items: [{ isbn: ISBN_SIN_PESO, cantidad: 1 }],
                    urlRetorno: "https://tienda-ajena.test/checkout/retorno"
                })
            );

        expect(res.status).toBe(422);
        expect(res.body.error.codigo).toBe("peso_faltante");
        expect(await contarPedidos(key)).toBe(0);
    });

    it("si falla MiCorreo la cotización informa proveedor_no_disponible", async () => {
        mocks.micorreo.getRates.mockRejectedValueOnce(new Error("caído"));

        const res = await publica(app, apiKeyAjeno, "https://tienda-ajena.test")
            .post("/public/tienda/v1/cotizar")
            .send({
                items: [{ isbn: ISBN_AJENO, cantidad: 1 }],
                entrega: {
                    tipo: "envio",
                    codigoPostal: "1043",
                    localidad: "CABA",
                    provincia: "C"
                }
            });

        expect(res.status).toBe(200);
        expect(res.body.envio).toMatchObject({ disponible: false, motivo: "proveedor_no_disponible" });
        expect(res.body.retiro.disponible).toBe(true);
    });
});
