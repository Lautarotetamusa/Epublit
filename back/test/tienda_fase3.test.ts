import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, desc, eq } from "drizzle-orm";

import * as dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from "../src/db/client";
import { createMockAfipService } from "../src/lib/afip/Afip.mock";
import { isbn } from "../seeders/data";
import { clientesTable } from "../src/modules/cliente/cliente.schema";
import { depositoLibrosTable } from "../src/modules/deposito/depositoLibros.schema";
import { mediosPagoTable } from "../src/modules/medioPago/medioPago.schema";
import { movimientosLibrosTable, movimientosTable } from "../src/modules/movimiento/movimiento.schema";
import { orderHistoryTable } from "../src/modules/tienda/order/orderHistory.schema";
import { ordersTable } from "../src/modules/tienda/order/order.schema";
import { paymentsTable } from "../src/modules/tienda/payment/payment.schema";
import { shippingConfigTable } from "../src/modules/tienda/shipping/shippingConfig.schema";
import { shipmentEventsTable, shipmentsTable } from "../src/modules/tienda/shipping/shipping.schema";
import { reservationsTable } from "../src/modules/tienda/stock/reservation.schema";
import { ventasTable } from "../src/modules/transaccion/venta.schema";
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

const ISBN_ENVIO = isbn(9750);
const ISBN_RETIRO = isbn(9751);
const ISBN_AJENO = isbn(9752);

let token: string;
let otroToken: string;
let userId: number;
let otroUserId: number;
let apiKey: string;
let depositoPrincipalId: number;
let libroEnvio: { id_libro: number };

let contador = 0;

const authRequest = (req: request.Test, value = token) =>
    req.set("Authorization", `Bearer ${value}`);

const crearPedido = async (
    overrides: { isbn?: string; cantidad?: number; entrega?: "envio" | "retiro"; email?: string } = {}
): Promise<string> => {
    contador += 1;
    let entrega: Record<string, unknown>;
    if ((overrides.entrega ?? "envio") === "retiro") {
        entrega = { tipo: "retiro" };
    } else {
        entrega = {
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
        };
    }

    const res = await publica(app, apiKey).post("/public/tienda/v1/pedidos", `fase3-${Date.now()}-${contador}`).send({
        comprador: {
            nombre: "Ana Tienda",
            email: overrides.email ?? `ana-fase3-${contador}@test.com`,
            telefono: "1122334455",
            documento: "20123456"
        },
        entrega,
        items: [{ isbn: overrides.isbn ?? ISBN_ENVIO, cantidad: overrides.cantidad ?? 1 }],
        urlRetorno: `${ORIGEN_TIENDA}/checkout/retorno`
    });

    expect(res.status).toBe(201);
    return res.body.pedido.codigo as string;
};

const getPedido = async (codigo: string) => {
    const [pedido] = await db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.codigo, codigo), eq(ordersTable.user, userId)));
    return pedido;
};

const marcarPagado = async (codigo: string) => {
    const pedido = await getPedido(codigo);
    const [pago] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.pedido_id, pedido.id))
        .orderBy(desc(paymentsTable.creado_en))
        .limit(1);

    await db
        .update(paymentsTable)
        .set({
            estado: "aprobado",
            pago_id: `pay-${codigo}`,
            fecha_pago: new Date()
        })
        .where(eq(paymentsTable.id, pago.id));

    await db
        .update(ordersTable)
        .set({ estado: "pagado", estado_pago: "aprobado" })
        .where(eq(ordersTable.id, pedido.id));

    return pedido;
};

const crearPedidoPagado = async (
    overrides: { isbn?: string; cantidad?: number; entrega?: "envio" | "retiro" } = {}
) => {
    const codigo = await crearPedido(overrides);
    const pedido = await marcarPagado(codigo);
    return { codigo, pedido };
};

const aceptar = async (codigo: string, value = token) =>
    authRequest(request(app).post(`/pedidos/${codigo}/aceptar`), value);

const aceptarPedido = async (
    overrides: { isbn?: string; cantidad?: number; entrega?: "envio" | "retiro" } = {}
) => {
    const { codigo } = await crearPedidoPagado(overrides);
    const res = await aceptar(codigo);
    expect(res.status).toBe(200);
    return { codigo, body: res.body };
};

const contarHistorial = async (pedidoId: number, tipo: string) => {
    const rows = await db
        .select()
        .from(orderHistoryTable)
        .where(and(eq(orderHistoryTable.pedido_id, pedidoId), eq(orderHistoryTable.tipo, tipo)));
    return rows.length;
};

const stockPrincipal = async (idLibro: number) => {
    const [row] = await db
        .select({ cantidad: depositoLibrosTable.cantidad })
        .from(depositoLibrosTable)
        .where(
            and(
                eq(depositoLibrosTable.deposito_id, depositoPrincipalId),
                eq(depositoLibrosTable.id_libro, idLibro)
            )
        );
    return row?.cantidad ?? 0;
};

beforeAll(async () => {
    token = await login(app, "libreria_sur");
    otroToken = await login(app, "editorial_norte");
    userId = await userIdDe("libreria_sur");
    otroUserId = await userIdDe("editorial_norte");

    apiKey = (await crearIntegracion(app, token)).apiKey;
    await crearIntegracion(app, otroToken, "Ajena fase 3", "https://tienda-ajena-f3.test");

    libroEnvio = await crearLibro(app, token, ISBN_ENVIO, { precio: 10000, pesoKg: 0.5 });
    await crearLibro(app, token, ISBN_RETIRO, { precio: 5000, pesoKg: 0.5 });
    await crearLibro(app, otroToken, ISBN_AJENO, { precio: 10000, pesoKg: 0.5 });

    await cargarStock(app, token, ISBN_ENVIO, 100);
    await cargarStock(app, token, ISBN_RETIRO, 100);
    await cargarStock(app, otroToken, ISBN_AJENO, 10);

    await guardarConfiguracionEnvios(app, token);
    await conectarMercadoPago(app, token);

    const depositos = await authRequest(request(app).get("/deposito/")).set("Authorization", `Bearer ${token}`);
    depositoPrincipalId = depositos.body.data.find((deposito: { principal: boolean }) => deposito.principal).id;
});

afterAll(async () => {
    await limpiarTienda(userId);
    await limpiarTienda(otroUserId);
    db.$client.end();
});

describe("Listado de pedidos", () => {
    it("filtra, cuenta sin el estado, busca y pagina", async () => {
        const envio = await crearPedido({ email: "Listado.UNO@test.com" });
        const retiro = await crearPedido({ entrega: "retiro", email: "listado.dos@test.com" });
        const pagado = await crearPedido({ email: "listado.tres@test.com" });
        await marcarPagado(pagado);

        const todos = await authRequest(request(app).get("/pedidos?porPagina=100"));
        expect(todos.status).toBe(200);
        expect(todos.body.pagina).toBe(1);
        expect(todos.body.porPagina).toBe(100);
        expect(todos.body.total).toBeGreaterThanOrEqual(3);
        expect(todos.body.pedidos[0]).toEqual(
            expect.objectContaining({
                codigo: expect.any(String),
                fecha: expect.any(String),
                comprador: expect.objectContaining({ nombre: "Ana Tienda" }),
                total: expect.any(Number),
                estadoPago: expect.any(String),
                entrega: expect.any(String),
                estado: expect.any(String),
                cantidadItems: expect.any(Number)
            })
        );
        const conteos = todos.body.conteos;
        expect(conteos.todos).toBe(
            ["pendiente_pago", "pagado", "aceptado", "enviado", "entregado", "rechazado", "cancelado"].reduce(
                (total, estado) => total + conteos[estado],
                0
            )
        );

        const soloPagados = await authRequest(request(app).get("/pedidos?estado=pagado&porPagina=100"));
        expect(soloPagados.status).toBe(200);
        expect(soloPagados.body.pedidos.every((pedido: { estado: string }) => pedido.estado === "pagado")).toBe(true);
        expect(soloPagados.body.conteos).toEqual(conteos);

        const soloRetiro = await authRequest(request(app).get("/pedidos?entrega=retiro&porPagina=100"));
        expect(soloRetiro.status).toBe(200);
        expect(soloRetiro.body.pedidos.every((pedido: { entrega: string }) => pedido.entrega === "retiro")).toBe(true);
        expect(soloRetiro.body.pedidos.map((pedido: { codigo: string }) => pedido.codigo)).toContain(retiro);
        expect(soloRetiro.body.pedidos.map((pedido: { codigo: string }) => pedido.codigo)).not.toContain(envio);

        const busqueda = await authRequest(request(app).get("/pedidos?buscar=LISTADO.uno&porPagina=100"));
        expect(busqueda.status).toBe(200);
        expect(busqueda.body.pedidos.map((pedido: { codigo: string }) => pedido.codigo)).toEqual([envio]);

        const busquedaCodigo = await authRequest(
            request(app).get(`/pedidos?buscar=${encodeURIComponent(pagado.toLowerCase())}&porPagina=100`)
        );
        expect(busquedaCodigo.body.pedidos.map((pedido: { codigo: string }) => pedido.codigo)).toEqual([pagado]);

        const primera = await authRequest(request(app).get("/pedidos?pagina=1&porPagina=1"));
        const segunda = await authRequest(request(app).get("/pedidos?pagina=2&porPagina=1"));
        expect(primera.body.pedidos).toHaveLength(1);
        expect(segunda.body.pedidos).toHaveLength(1);
        expect(primera.body.pedidos[0].codigo).not.toBe(segunda.body.pedidos[0].codigo);
    });

    it("interpreta fechas inclusivas en hora argentina", async () => {
        const dentro = await crearPedido({ email: "rango.dentro@test.com" });
        const fuera = await crearPedido({ email: "rango.fuera@test.com" });

        await db
            .update(ordersTable)
            .set({ creado_en: new Date("2026-10-20T15:00:00.000-03:00") })
            .where(and(eq(ordersTable.codigo, dentro), eq(ordersTable.user, userId)));
        await db
            .update(ordersTable)
            .set({ creado_en: new Date("2026-10-22T15:00:00.000-03:00") })
            .where(and(eq(ordersTable.codigo, fuera), eq(ordersTable.user, userId)));

        const res = await authRequest(
            request(app).get("/pedidos?desde=2026-10-20&hasta=2026-10-20&porPagina=100")
        );
        expect(res.status).toBe(200);
        const codigos = res.body.pedidos.map((pedido: { codigo: string }) => pedido.codigo);
        expect(codigos).toContain(dentro);
        expect(codigos).not.toContain(fuera);
    });

    it("valida filtros y paginación", async () => {
        for (const query of [
            "estado=inventado",
            "entrega=avion",
            "desde=2026-13-01",
            "hasta=2026-02-31",
            "pagina=0",
            "porPagina=0",
            "porPagina=101",
            "desde=2026-10-20&hasta=2026-10-19"
        ]) {
            const res = await authRequest(request(app).get(`/pedidos?${query}`));
            expect(res.status).toBe(400);
            expect(res.body.errors[0].code).toBeDefined();
        }
    });

    it("aísla cuentas y devuelve recorte vacío con conteos en cero", async () => {
        const codigo = await crearPedido({ email: "aislado@test.com" });

        const ajeno = await authRequest(
            request(app).get(`/pedidos?buscar=${encodeURIComponent(codigo)}&porPagina=100`),
            otroToken
        );
        expect(ajeno.status).toBe(200);
        expect(ajeno.body.pedidos).toHaveLength(0);

        const detalleAjeno = await authRequest(request(app).get(`/pedidos/${codigo}`), otroToken);
        expect(detalleAjeno.status).toBe(404);

        const vacio = await authRequest(request(app).get("/pedidos?buscar=no-existe-jamas&porPagina=100"));
        expect(vacio.status).toBe(200);
        expect(vacio.body.pedidos).toEqual([]);
        expect(vacio.body.total).toBe(0);
        expect(vacio.body.conteos.todos).toBe(0);
    });
});

describe("Detalle y archivos", () => {
    it("devuelve la ficha completa y el comprobante sólo al dueño", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 2 });

        const res = await authRequest(request(app).get(`/pedidos/${codigo}`));
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            codigo,
            estado: "aceptado",
            estadoPago: "aprobado",
            comprador: {
                nombre: "Ana Tienda",
                email: expect.any(String),
                telefono: "1122334455",
                documento: "20123456"
            },
            entrega: {
                tipo: "envio",
                direccion: {
                    calle: "Av. Corrientes",
                    numero: "1234",
                    localidad: "CABA",
                    codigoPostal: "1043"
                },
                costoEnvio: 3200
            },
            subtotal: 20000,
            costoEnvio: 3200,
            total: 23200,
            pesoKg: 1,
            caja: { altoCm: 10, anchoCm: 15, largoCm: 20 },
            pago: {
                proveedor: "mercadopago",
                estado: "aprobado",
                idOperacion: expect.any(String),
                importe: 23200,
                moneda: "ARS"
            },
            venta: {
                id: expect.any(Number),
                total: 23200,
                tipoCbte: 6
            },
            comprobante: {
                id: expect.any(Number),
                clase: "factura",
                estado: "emitida",
                tipo: { codigo: 6, letra: "B", nombre: "Factura B" },
                numero: expect.any(Number),
                numeroCompleto: expect.stringMatching(/^00001-\d{8}$/),
                fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
            }
        });
        expect(res.body.items).toEqual([
            {
                isbn: ISBN_ENVIO,
                titulo: expect.any(String),
                cantidad: 2,
                precioUnitario: 10000,
                subtotal: 20000
            }
        ]);
        expect(res.body.historial.map((hito: { tipo: string }) => hito.tipo)).toEqual(
            expect.arrayContaining(["pedido_creado", "pedido_aceptado", "comprobante_emitido"])
        );

        const comprobante = await authRequest(
            request(app).get(`/comprobantes/${res.body.comprobante.id}`)
        );
        expect(comprobante.status).toBe(200);
        expect(comprobante.body.data).toMatchObject({
            clase: "factura",
            estado: "emitida",
            cae: expect.any(String),
            qr: { url: expect.stringContaining("afip.gob.ar"), dataUrl: expect.stringContaining("data:image/png;base64,") },
            importes: { total: 23200 }
        });
        expect(comprobante.body.data.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ isbn: ISBN_ENVIO, cantidad: 2, subtotal: 20000 }),
                expect.objectContaining({ isbn: null, titulo: "Envío", subtotal: 3200 })
            ])
        );

        const pdfViejo = await authRequest(request(app).get(`/pedidos/${codigo}/comprobante`));
        expect(pdfViejo.status).toBe(404);

        const ajeno = await authRequest(
            request(app).get(`/comprobantes/${res.body.comprobante.id}`),
            otroToken
        );
        expect(ajeno.status).toBe(404);
    });

    it("comprobante null antes de aceptar y en pedidos ajenos", async () => {
        const codigo = await crearPedido();

        const res = await authRequest(request(app).get(`/pedidos/${codigo}`));
        expect(res.status).toBe(200);
        expect(res.body.comprobante).toBeNull();

        const viejo = await authRequest(request(app).get(`/pedidos/${codigo}/comprobante`));
        expect(viejo.status).toBe(404);

        const ajeno = await authRequest(request(app).get(`/pedidos/${codigo}`), otroToken);
        expect(ajeno.status).toBe(404);
    });

    it("en retiro no hay bloque de correo y /envio responde sin_envio", async () => {
        const { codigo } = await aceptarPedido({ entrega: "retiro", isbn: ISBN_RETIRO });

        const detalle = await authRequest(request(app).get(`/pedidos/${codigo}`));
        expect(detalle.status).toBe(200);
        expect(detalle.body.entrega).toMatchObject({
            tipo: "retiro",
            punto: "Av. Retiro 123",
            horario: "Lunes a viernes de 9 a 18"
        });
        expect(detalle.body.envio).toBeNull();

        const envio = await authRequest(request(app).get(`/pedidos/${codigo}/envio`));
        expect(envio.status).toBe(409);
        expect(envio.body.errors[0].code).toBe("sin_envio");
    });
});

describe("Aceptación y venta", () => {
    it("crea una sola venta, convierte la reserva y baja stock una vez", async () => {
        const { codigo } = await crearPedidoPagado({ cantidad: 2 });
        const pedido = await getPedido(codigo);
        const stockAntes = await stockPrincipal(libroEnvio.id_libro);

        const res = await aceptar(codigo);
        expect(res.status).toBe(200);
        expect(res.body.estado).toBe("aceptado");
        expect(res.body.venta).toMatchObject({ total: 23200, tipoCbte: 6 });

        const actualizado = await getPedido(codigo);
        expect(actualizado.venta_id).not.toBeNull();

        const movimientos = await db
            .select()
            .from(movimientosTable)
            .where(
                and(
                    eq(movimientosTable.id, actualizado.venta_id!),
                    eq(movimientosTable.user, userId),
                    eq(movimientosTable.tipo, "venta")
                )
            );
        expect(movimientos).toHaveLength(1);
        expect(movimientos[0]).toMatchObject({ origen_tipo: "deposito", destino_tipo: "exterior" });

        const lineas = await db
            .select()
            .from(movimientosLibrosTable)
            .where(eq(movimientosLibrosTable.movimiento_id, actualizado.venta_id!));
        expect(lineas).toHaveLength(1);
        expect(lineas[0]).toMatchObject({
            id_libro: libroEnvio.id_libro,
            cantidad: 2,
            precio: 10000
        });

        const [venta] = await db
            .select()
            .from(ventasTable)
            .where(eq(ventasTable.id_movimiento, actualizado.venta_id!));
        expect(venta).toMatchObject({ total: 23200, tipo_cbte: 6 });

        const [cliente] = await db
            .select()
            .from(clientesTable)
            .where(eq(clientesTable.id, venta.id_cliente));
        expect(cliente).toMatchObject({ nombre: "CONSUMIDOR FINAL", tipo: "particular" });

        const [medio] = await db
            .select()
            .from(mediosPagoTable)
            .where(eq(mediosPagoTable.id, venta.id_medio_pago));
        expect(medio.nombre).toBe("mercadopago");

        expect(await stockPrincipal(libroEnvio.id_libro)).toBe(stockAntes - 2);

        const reservas = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reservas.every((reserva) => reserva.estado === "convertida")).toBe(true);

        expect(await contarHistorial(pedido.id, "pedido_aceptado")).toBe(1);
        expect(await contarHistorial(pedido.id, "comprobante_emitido")).toBe(1);
        expect(await stockPrincipal(libroEnvio.id_libro)).toBe(stockAntes - 2);

        const ventasAntes = await db
            .select()
            .from(movimientosTable)
            .where(and(eq(movimientosTable.user, userId), eq(movimientosTable.tipo, "venta")));

        const segunda = await aceptar(codigo);
        expect(segunda.status).toBe(409);

        const ventasDespues = await db
            .select()
            .from(movimientosTable)
            .where(and(eq(movimientosTable.user, userId), eq(movimientosTable.tipo, "venta")));
        expect(ventasDespues).toHaveLength(ventasAntes.length);
        expect(await stockPrincipal(libroEnvio.id_libro)).toBe(stockAntes - 2);
    });

    it("dos aceptaciones concurrentes generan una sola venta", async () => {
        const { codigo } = await crearPedidoPagado({ cantidad: 1 });
        const [primera, segunda] = await Promise.all([aceptar(codigo), aceptar(codigo)]);

        const estados = [primera.status, segunda.status].sort();
        expect(estados).toEqual([200, 409]);

        const pedido = await getPedido(codigo);
        const ventas = await db
            .select()
            .from(ventasTable)
            .where(eq(ventasTable.id_movimiento, pedido.venta_id!));
        expect(ventas).toHaveLength(1);
    });

    it("devuelve 409 accionable si falta CONSUMIDOR FINAL o el medio MercadoPago", async () => {
        const { codigo, pedido } = await crearPedidoPagado({ cantidad: 1 });

        const [consumidor] = await db
            .select()
            .from(clientesTable)
            .where(
                and(
                    eq(clientesTable.user, userId),
                    eq(clientesTable.nombre, "CONSUMIDOR FINAL"),
                    eq(clientesTable.tipo, "particular")
                )
            );
        await db
            .update(clientesTable)
            .set({ nombre: "CONSUMIDOR FINAL OCULTO" })
            .where(eq(clientesTable.id, consumidor.id));

        const sinCliente = await aceptar(codigo);
        expect(sinCliente.status).toBe(409);
        expect(await getPedido(codigo)).toMatchObject({ estado: "pagado", venta_id: null });

        await db
            .update(clientesTable)
            .set({ nombre: "CONSUMIDOR FINAL" })
            .where(eq(clientesTable.id, consumidor.id));

        const [medio] = await db
            .select()
            .from(mediosPagoTable)
            .where(
                and(
                    eq(mediosPagoTable.user, userId),
                    eq(mediosPagoTable.nombre, "mercadopago")
                )
            );
        await db
            .update(mediosPagoTable)
            .set({ nombre: "mercadopago oculto" })
            .where(eq(mediosPagoTable.id, medio.id));

        const sinMedio = await aceptar(codigo);
        expect(sinMedio.status).toBe(409);
        expect(await getPedido(codigo)).toMatchObject({ estado: "pagado", venta_id: null });

        await db
            .update(mediosPagoTable)
            .set({ nombre: "mercadopago" })
            .where(eq(mediosPagoTable.id, medio.id));

        const ok = await aceptar(codigo);
        expect(ok.status).toBe(200);
        expect(await getPedido(codigo)).toMatchObject({ estado: "aceptado" });
        expect((await getPedido(pedido.codigo)).venta_id).not.toBeNull();
    });

    it("404 al aceptar un pedido de otra cuenta", async () => {
        const { codigo } = await crearPedidoPagado();
        const res = await aceptar(codigo, otroToken);
        expect(res.status).toBe(404);
    });
});

describe("Facturación", () => {
    const afipRoto = createMockAfipService({
        getClient: () => {
            throw new Error("AFIP no configurado");
        }
    });
    const entornoRoto = crearEntorno(undefined, { afipService: afipRoto });

    it("un fallo de AFIP deja la venta y el comprobante en error, y el reintento no duplica", async () => {
        const { codigo } = await crearPedidoPagado({ cantidad: 1 });
        const tokenRoto = await login(entornoRoto.app, "libreria_sur");

        const aceptada = await authRequest(
            request(entornoRoto.app).post(`/pedidos/${codigo}/aceptar`),
            tokenRoto
        );
        expect(aceptada.status).toBe(200);
        expect(aceptada.body.estado).toBe("aceptado");
        expect(aceptada.body.venta).not.toBeNull();
        expect(aceptada.body.comprobante).toMatchObject({
            estado: "error",
            numero: null
        });
        const comprobanteError = await authRequest(
            request(app).get(`/comprobantes/${aceptada.body.comprobante.id}`),
            tokenRoto
        );
        expect(comprobanteError.body.data.error).toEqual({
            codigo: null,
            mensaje: "AFIP no configurado"
        });

        const pedido = await getPedido(codigo);
        expect(pedido.venta_id).not.toBeNull();

        const reintento = await authRequest(request(app).post(`/pedidos/${codigo}/facturar`));
        expect(reintento.status).toBe(200);
        expect(reintento.body.comprobante.estado).toBe("emitida");

        const movimientos = await db
            .select()
            .from(movimientosTable)
            .where(and(eq(movimientosTable.user, userId), eq(movimientosTable.id, pedido.venta_id!)));
        expect(movimientos).toHaveLength(1);

        const numero = reintento.body.comprobante.numero;
        const repetido = await authRequest(request(app).post(`/pedidos/${codigo}/facturar`));
        expect(repetido.status).toBe(200);
        expect(repetido.body.comprobante.numero).toBe(numero);
        expect(await contarHistorial(pedido.id, "comprobante_emitido")).toBe(1);
    });
});

describe("Rechazo y reembolso", () => {
    it("rechaza pendiente sin reembolsar y libera la reserva", async () => {
        const codigo = await crearPedido();
        const pedido = await getPedido(codigo);

        const res = await authRequest(
            request(app).post(`/pedidos/${codigo}/rechazar`).send({ motivo: "Sin stock" })
        );
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            estado: "rechazado",
            estadoPago: "pendiente",
            motivoRechazo: "Sin stock"
        });

        const reservas = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reservas.every((reserva) => reserva.estado === "liberada")).toBe(true);
        expect(await contarHistorial(pedido.id, "pedido_rechazado")).toBe(1);

        const repetido = await authRequest(
            request(app).post(`/pedidos/${codigo}/rechazar`).send({ motivo: "Otra vez" })
        );
        expect(repetido.status).toBe(409);
    });

    it("rechaza pagado, reembolsa y registra ambos hitos; sin duplicar", async () => {
        const { codigo } = await crearPedidoPagado();
        const pedido = await getPedido(codigo);
        mocks.mp.refundPayment.mockClear();

        const res = await authRequest(
            request(app).post(`/pedidos/${codigo}/rechazar`).send({
                motivo: "No hay stock",
                detalle: "Se agotó el título"
            })
        );
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            estado: "rechazado",
            estadoPago: "reembolsado",
            motivoRechazo: "No hay stock",
            detalleRechazo: "Se agotó el título"
        });
        expect(mocks.mp.refundPayment).toHaveBeenCalledTimes(1);
        expect(await contarHistorial(pedido.id, "pedido_rechazado")).toBe(1);
        expect(await contarHistorial(pedido.id, "pago_reembolsado")).toBe(1);

        const repetido = await authRequest(
            request(app).post(`/pedidos/${codigo}/rechazar`).send({ motivo: "Otra vez" })
        );
        expect(repetido.status).toBe(409);
        expect(mocks.mp.refundPayment).toHaveBeenCalledTimes(1);
    });

    it("si MercadoPago no confirma el reembolso no cambia nada y permite reintentar", async () => {
        const { codigo } = await crearPedidoPagado();
        const pedido = await getPedido(codigo);
        mocks.mp.refundPayment.mockRejectedValueOnce(new Error("MP caído"));

        const fallido = await authRequest(
            request(app).post(`/pedidos/${codigo}/rechazar`).send({ motivo: "Falla" })
        );
        expect(fallido.status).toBe(502);

        const sinCambios = await getPedido(codigo);
        expect(sinCambios).toMatchObject({ estado: "pagado", estado_pago: "aprobado" });
        const reservas = await db
            .select()
            .from(reservationsTable)
            .where(eq(reservationsTable.pedido_id, pedido.id));
        expect(reservas.every((reserva) => reserva.estado === "activa")).toBe(true);

        const reintento = await authRequest(
            request(app).post(`/pedidos/${codigo}/rechazar`).send({ motivo: "Falla" })
        );
        expect(reintento.status).toBe(200);
        expect(reintento.body).toMatchObject({ estado: "rechazado", estadoPago: "reembolsado" });
    });

    it("exige motivo y no rechaza estados posteriores a la aceptación", async () => {
        const codigo = await crearPedido();
        const sinMotivo = await authRequest(
            request(app).post(`/pedidos/${codigo}/rechazar`).send({})
        );
        expect(sinMotivo.status).toBe(400);

        const { codigo: aceptado } = await aceptarPedido({ cantidad: 1 });
        const res = await authRequest(
            request(app).post(`/pedidos/${aceptado}/rechazar`).send({ motivo: "Tarde" })
        );
        expect(res.status).toBe(409);
    });
});

describe("Etiqueta de PAQ.AR", () => {
    it("genera, reutiliza y descarga la etiqueta sin cambiar el estado", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 2 });
        mocks.paqar.createOrder.mockClear();
        mocks.paqar.createLabel.mockClear();

        const generada = await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({}));
        expect(generada.status).toBe(200);
        expect(generada.body.envio).toMatchObject({
            proveedorEnvioId: expect.any(String),
            codigoSeguimiento: expect.any(String),
            etiquetaDisponible: true,
            etiquetaUrl: `/pedidos/${codigo}/etiqueta`,
            etiquetaCreadaEl: expect.any(String)
        });
        expect(mocks.paqar.createOrder).toHaveBeenCalledTimes(1);
        expect(mocks.paqar.createLabel).toHaveBeenCalledTimes(1);

        const payload = mocks.paqar.createOrder.mock.calls[0][1];
        expect(payload).toMatchObject({
            shipmentClientId: codigo,
            deliveryType: "homeDelivery",
            serviceType: "CP",
            parcels: [
                {
                    dimensions: { height: "10", width: "15", depth: "20" },
                    productWeight: "1000",
                    productCategory: "Libros",
                    declaredValue: "23200"
                }
            ]
        });

        expect((await getPedido(codigo)).estado).toBe("aceptado");

        const repetida = await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({}));
        expect(repetida.status).toBe(200);
        expect(repetida.body.envio).toEqual(generada.body.envio);
        expect(mocks.paqar.createOrder).toHaveBeenCalledTimes(1);
        expect(mocks.paqar.createLabel).toHaveBeenCalledTimes(1);

        const pdf = await authRequest(request(app).get(`/pedidos/${codigo}/etiqueta`));
        expect(pdf.status).toBe(200);
        expect(pdf.headers["content-type"]).toContain("application/pdf");

        const ajeno = await authRequest(request(app).get(`/pedidos/${codigo}/etiqueta`), otroToken);
        expect(ajeno.status).toBe(404);
    });

    it("usa peso y caja congelados del pedido, no los valores actuales", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 1 });
        mocks.paqar.createOrder.mockClear();

        await guardarConfiguracionEnvios(app, token, {
            cajaDefault: { altoCm: 99, anchoCm: 99, largoCm: 99 },
            pesoPromedioKg: 9
        });

        const res = await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({}));
        expect(res.status).toBe(200);
        expect(mocks.paqar.createOrder.mock.calls[0][1].parcels[0]).toEqual({
            dimensions: { height: "10", width: "15", depth: "20" },
            productWeight: "500",
            productCategory: "Libros",
            declaredValue: "13200"
        });

        await guardarConfiguracionEnvios(app, token);
    });

    it("mapea correo no configurado, dirección inválida, peso faltante y fallas del proveedor", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 1 });

        await db.delete(shippingConfigTable).where(eq(shippingConfigTable.user, userId));
        const sinCorreo = await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({}));
        expect(sinCorreo.status).toBe(422);
        expect(sinCorreo.body.errors[0].code).toBe("correo_no_configurado");

        await guardarConfiguracionEnvios(app, token);
        await db
            .update(ordersTable)
            .set({ entrega_calle: null })
            .where(eq(ordersTable.codigo, codigo));

        const sinDireccion = await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({}));
        expect(sinDireccion.status).toBe(422);
        expect(sinDireccion.body.errors[0].code).toBe("direccion_invalida");

        const corregida = await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({
            direccion: {
                calle: "Av. Corregida",
                numero: "999",
                localidad: "CABA",
                provincia: "C",
                codigoPostal: "1043"
            }
        }));
        expect(corregida.status).toBe(200);
        expect((await getPedido(codigo)).entrega_calle).toBe("Av. Corregida");

        const { codigo: sinPeso } = await aceptarPedido({ cantidad: 1 });
        await db
            .update(ordersTable)
            .set({ peso_kg: null })
            .where(eq(ordersTable.codigo, sinPeso));
        await guardarConfiguracionEnvios(app, token, { pesoPromedioKg: null });

        const faltante = await authRequest(request(app).post(`/pedidos/${sinPeso}/etiqueta`).send({}));
        expect(faltante.status).toBe(422);
        expect(faltante.body.errors[0].code).toBe("peso_faltante");

        await guardarConfiguracionEnvios(app, token);

        const { codigo: caida } = await aceptarPedido({ cantidad: 1 });
        mocks.paqar.createOrder.mockRejectedValueOnce(new Error("PAQ.AR caído"));
        const proveedor = await authRequest(request(app).post(`/pedidos/${caida}/etiqueta`).send({}));
        expect(proveedor.status).toBe(502);
        expect(proveedor.body.errors[0].code).toBe("proveedor_no_disponible");
        expect((await getPedido(caida)).estado).toBe("aceptado");

        mocks.paqar.createOrder.mockRejectedValueOnce(new Error("etiqueta duplicada"));
        const duplicada = await authRequest(request(app).post(`/pedidos/${caida}/etiqueta`).send({}));
        expect(duplicada.status).toBe(409);
        expect(duplicada.body.errors[0].code).toBe("etiqueta_duplicada");
    });

    it("un pedido de retiro no genera etiqueta", async () => {
        const { codigo } = await aceptarPedido({ entrega: "retiro", isbn: ISBN_RETIRO });
        const res = await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({}));
        expect(res.status).toBe(409);
        expect(res.body.errors[0].code).toBe("sin_envio");
    });
});

describe("Envío y entrega", () => {
    it("despacha generando la etiqueta y no permite repetir", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 1 });
        mocks.paqar.createOrder.mockClear();

        const res = await authRequest(request(app).post(`/pedidos/${codigo}/enviar`));
        expect(res.status).toBe(200);
        expect(res.body.estado).toBe("enviado");
        expect(mocks.paqar.createOrder).toHaveBeenCalledTimes(1);

        const [envio] = await db
            .select()
            .from(shipmentsTable)
            .innerJoin(ordersTable, eq(ordersTable.id, shipmentsTable.pedido_id))
            .where(eq(ordersTable.codigo, codigo));
        expect(envio.envios.despachado_en).not.toBeNull();

        const repetido = await authRequest(request(app).post(`/pedidos/${codigo}/enviar`));
        expect(repetido.status).toBe(409);
    });

    it("si falla la etiqueta no despacha y deja el pedido aceptado", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 1 });
        mocks.paqar.createOrder.mockRejectedValueOnce(new Error("PAQ.AR caído"));

        const res = await authRequest(request(app).post(`/pedidos/${codigo}/enviar`));
        expect(res.status).toBe(502);
        expect((await getPedido(codigo)).estado).toBe("aceptado");
    });

    it("entrega enviados y retiros aceptados; rechaza el resto", async () => {
        const { codigo: enviado } = await aceptarPedido({ cantidad: 1 });
        await authRequest(request(app).post(`/pedidos/${enviado}/enviar`));

        const entrega = await authRequest(request(app).post(`/pedidos/${enviado}/entregar`));
        expect(entrega.status).toBe(200);
        expect(entrega.body.estado).toBe("entregado");

        const repetida = await authRequest(request(app).post(`/pedidos/${enviado}/entregar`));
        expect(repetida.status).toBe(409);

        const { codigo: retiro } = await aceptarPedido({ entrega: "retiro", isbn: ISBN_RETIRO });
        const retiroEnviar = await authRequest(request(app).post(`/pedidos/${retiro}/enviar`));
        expect(retiroEnviar.status).toBe(409);
        expect(retiroEnviar.body.errors[0].code).toBe("sin_envio");

        const retiroEntregar = await authRequest(request(app).post(`/pedidos/${retiro}/entregar`));
        expect(retiroEntregar.status).toBe(200);
        expect(retiroEntregar.body.estado).toBe("entregado");

        const { codigo: aceptadoEnvio } = await aceptarPedido({ cantidad: 1 });
        const anticipado = await authRequest(request(app).post(`/pedidos/${aceptadoEnvio}/entregar`));
        expect(anticipado.status).toBe(409);
    });
});

describe("Seguimiento PAQ.AR", () => {
    it("persiste y deduplica eventos; una falla conserva el último estado", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 1 });
        mocks.paqar.getTracking.mockClear();

        const sinCodigo = await authRequest(request(app).get(`/pedidos/${codigo}/envio`));
        expect(sinCodigo.status).toBe(200);
        expect(sinCodigo.body).toMatchObject({
            proveedor: "PAQ.AR",
            numeroEnvio: null,
            codigoSeguimiento: null,
            url: null,
            eventos: []
        });

        await authRequest(request(app).post(`/pedidos/${codigo}/etiqueta`).send({}));
        await authRequest(request(app).post(`/pedidos/${codigo}/enviar`));
        const primera = await authRequest(request(app).post(`/pedidos/${codigo}/envio/refrescar`));
        expect(primera.status).toBe(200);
        expect(primera.body).toMatchObject({
            estado: "en_transito",
            codigoSeguimiento: expect.any(String),
            url: "https://www.correoargentino.com.ar/formularios/e-commerce"
        });
        expect(primera.body.eventos).toHaveLength(1);
        expect(primera.body.eventos[0]).toMatchObject({
            estado: "en_transito",
            statusId: "1",
            facility: "CABA"
        });

        const deduplicada = await authRequest(request(app).post(`/pedidos/${codigo}/envio/refrescar`));
        expect(deduplicada.status).toBe(200);
        expect(deduplicada.body.eventos).toHaveLength(1);

        const [envio] = await db
            .select()
            .from(shipmentsTable)
            .innerJoin(ordersTable, eq(ordersTable.id, shipmentsTable.pedido_id))
            .where(eq(ordersTable.codigo, codigo));
        const eventos = await db
            .select()
            .from(shipmentEventsTable)
            .where(eq(shipmentEventsTable.envio_id, envio.envios.id));
        expect(eventos).toHaveLength(1);

        mocks.paqar.getTracking.mockRejectedValueOnce(new Error("PAQ.AR caído"));
        const falla = await authRequest(request(app).post(`/pedidos/${codigo}/envio/refrescar`));
        expect(falla.status).toBe(200);
        expect(falla.body.estado).toBe("en_transito");
        expect(falla.body.error).toEqual(expect.any(String));
        expect(falla.body.eventos).toHaveLength(1);

        expect((await getPedido(codigo)).estado).toBe("enviado");
    });

    it("sin código responde 409 al refrescar y en retiro 409 sin_envio", async () => {
        const { codigo } = await aceptarPedido({ cantidad: 1 });
        const sinCodigo = await authRequest(request(app).post(`/pedidos/${codigo}/envio/refrescar`));
        expect(sinCodigo.status).toBe(409);
        expect(sinCodigo.body.errors[0].code).toBe("sin_envio");

        const { codigo: retiro } = await aceptarPedido({ entrega: "retiro", isbn: ISBN_RETIRO });
        const refrescar = await authRequest(request(app).post(`/pedidos/${retiro}/envio/refrescar`));
        expect(refrescar.status).toBe(409);
        expect(refrescar.body.errors[0].code).toBe("sin_envio");
    });
});
