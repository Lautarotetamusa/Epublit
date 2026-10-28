import { describe, expect, it, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import fs from "fs";
import { join } from "path";

import * as dotenv from "dotenv";
dotenv.config({ path: join(__dirname, "../.env") });

import { db } from "../src/db/client";
import { env } from "../src/env";
import { createApp } from "../src/app";
import { createContainer } from "../src/container";
import { createMockAfipService } from "../src/lib/afip/Afip.mock";
import { facturar } from "../src/lib/afip/Afip";
import type { ComprobanteAfip, IAfip } from "../src/lib/afip/Afip";
import { clientesTable } from "../src/modules/cliente/cliente.schema";
import {
    comprobantesTable,
    facturasTable
} from "../src/modules/comprobante/comprobante.schema";
import { librosTable } from "../src/modules/libro/libro.schema";
import { movimientosTable } from "../src/modules/movimiento/movimiento.schema";
import { usersTable } from "../src/modules/user/user.schema";
import { cuit, isbn } from "../seeders/data";
import { PASSWORD_SEED } from "../seeders/users.seeder";
import { cargarStockPrincipal, getMedioPagoId } from "./util";

const app = createApp(createContainer({ afipService: createMockAfipService() }));

let token: string;
let otroToken: string;
let userId: number;
let efectivoId: number;

const emisorSnapshot = (cuitEmisor = "20123456789") => ({
    razonSocial: "Librería Sur SRL",
    cuit: cuitEmisor,
    condicionFiscal: "RESPONSABLE INSCRIPTO",
    domicilio: "San Martín 100",
    ingresosBrutos: null,
    inicioActividades: "01/01/2020",
    email: null,
    logoUrl: null
});

const receptorSnapshot = () => ({
    razonSocial: "CONSUMIDOR FINAL",
    cuit: null,
    documento: null,
    condicionFiscal: "CONSUMIDOR FINAL",
    domicilio: "",
    condicionVenta: "Contado"
});

const auth = (req: request.Test, value = token) =>
    req.set("Authorization", `Bearer ${value}`);

const crearCliente = async (nombre: string, cuitCliente: string): Promise<number> => {
    const res = await auth(
        request(app).post("/cliente/").send({ nombre, email: `${nombre.replace(/\s/g, "")}-${cuitCliente}@test.com`, cuit: cuitCliente })
    );
    expect(res.status).toBe(201);
    return res.body.data.id;
};

const crearLibro = async (isbnLibro: string, titulo: string, stock = 5): Promise<number> => {
    const res = await auth(
        request(app)
            .post("/libro/")
            .send({ isbn: isbnLibro, titulo, fecha_edicion: "2020-01-01", precio: 1000 })
    );
    expect(res.status).toBe(201);

    const movimiento = await cargarStockPrincipal(app, token, isbnLibro, stock);
    expect(movimiento.status).toBe(201);

    return res.body.data.id_libro;
};

const crearVenta = async (
    cliente: number,
    isbnLibro: string,
    cantidad = 1,
    appVenta = app,
    tokenVenta = token
) => {
    const res = await request(appVenta)
        .post("/venta/")
        .set("Authorization", `Bearer ${tokenVenta}`)
        .send({
            cliente,
            medio_pago: efectivoId,
            tipo_cbte: 11,
            libros: [{ isbn: isbnLibro, cantidad }]
        });

    expect(res.status).toBe(201);
    return res.body.data;
};

beforeAll(async () => {
    const login = await request(app)
        .post("/user/login")
        .send({ username: "libreria_sur", password: PASSWORD_SEED });
    token = login.body.token;

    const loginOtro = await request(app)
        .post("/user/login")
        .send({ username: "editorial_norte", password: PASSWORD_SEED });
    otroToken = loginOtro.body.token;

    const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, "libreria_sur"));
    userId = user.id;

    efectivoId = await getMedioPagoId(app, token, "efectivo");
});

afterAll(() => {
    db.$client.end();
});

describe("GET /comprobantes/:id", () => {
    it("devuelve el DTO de la factura emitida sin datos internos", async () => {
        const cliente = await crearCliente("Cliente comprobante DTO", cuit(8500));
        await crearLibro(isbn(8500), "Libro comprobante DTO", 5);
        const venta = await crearVenta(cliente, isbn(8500), 2);

        expect(venta.comprobante).toMatchObject({ clase: "factura", estado: "emitida" });

        const res = await auth(request(app).get(`/comprobantes/${venta.comprobante.id}`));
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            id: venta.comprobante.id,
            clase: "factura",
            estado: "emitida",
            plantillaVersion: 1,
            tipo: { codigo: 11, letra: "C", nombre: "Factura C" },
            numero: expect.any(Number),
            numeroCompleto: expect.stringMatching(/^00001-\d{8}$/),
            fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            cae: expect.any(String),
            caeVencimiento: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            resultado: "A",
            moneda: "ARS",
            importes: {
                subtotal: 2000,
                envio: 0,
                descuento: 0,
                neto: 2000,
                total: 2000
            },
            emisor: {
                razonSocial: "Librería Sur SRL",
                cuit: expect.any(String)
            },
            receptor: {
                razonSocial: "CLIENTE DE PRUEBA",
                condicionVenta: "efectivo"
            },
            qr: {
                url: expect.stringContaining("afip.gob.ar/fe/qr/?p="),
                dataUrl: expect.stringMatching(/^data:image\/png;base64,/)
            },
            error: null,
            emitidoEn: expect.any(String)
        });
        expect(res.body.data).not.toHaveProperty("datos_afip");
        expect(res.body.data).not.toHaveProperty("file_path");
    });

    it("responde 404 para otra cuenta, id inválido y ruta de archivo eliminada", async () => {
        const cliente = await crearCliente("Cliente comprobante ajeno", cuit(8501));
        await crearLibro(isbn(8501), "Libro comprobante ajeno");
        const venta = await crearVenta(cliente, isbn(8501));

        expect((await auth(request(app).get(`/comprobantes/${venta.comprobante.id}`), otroToken)).status).toBe(404);
        expect((await request(app).get(`/comprobantes/${venta.comprobante.id}`)).status).toBe(401);
        expect((await auth(request(app).get("/comprobantes/999999999"))).status).toBe(404);
        expect((await auth(request(app).get("/comprobantes/no-es-un-id"))).status).toBe(404);
        expect((await auth(request(app).get(`/comprobantes/${venta.comprobante.id}/archivo`))).status).toBe(404);
    });

    it("devuelve 200 con estado pendiente y sin CAE ni QR", async () => {
        const isbnPendiente = isbn(8502);
        await crearLibro(isbnPendiente, "Libro comprobante pendiente");
        const movimiento = await cargarStockPrincipal(app, token, isbnPendiente, 1);
        expect(movimiento.status).toBe(201);

        const [comprobante] = await db
            .insert(comprobantesTable)
            .values({
                user: userId,
                tipo: "factura_c",
                movimiento_id: movimiento.body.data.id,
                punto_venta: 1,
                estado: "pendiente",
                emisor: emisorSnapshot(),
                receptor: receptorSnapshot(),
                items: []
            })
            .returning();
        await db.insert(facturasTable).values({
            comprobante_id: comprobante.id,
            codigo_afip: 11
        });

        const res = await auth(request(app).get(`/comprobantes/${comprobante.id}`));
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({
            estado: "pendiente",
            numero: null,
            numeroCompleto: null,
            fecha: null,
            cae: null,
            qr: null,
            error: null
        });
    });
});

describe("snapshot inmutable", () => {
    it("cambiar el cliente, el libro o la cuenta después de emitir no altera el DTO", async () => {
        const clienteId = await crearCliente("Cliente snapshot", cuit(8503));
        const isbnLibro = isbn(8503);
        await crearLibro(isbnLibro, "Título original snapshot");
        const venta = await crearVenta(clienteId, isbnLibro, 1);

        const [userAntes] = await db
            .select({ razon_social: usersTable.razon_social })
            .from(usersTable)
            .where(eq(usersTable.id, userId));
        const [clienteAntes] = await db
            .select({ razon_social: clientesTable.razon_social, domicilio: clientesTable.domicilio })
            .from(clientesTable)
            .where(and(eq(clientesTable.id, clienteId), eq(clientesTable.user, userId)));
        const [libroAntes] = await db
            .select({ titulo: librosTable.titulo })
            .from(librosTable)
            .where(and(eq(librosTable.isbn, isbnLibro), eq(librosTable.user, userId)));

        try {
            await db
                .update(clientesTable)
                .set({ razon_social: "CLIENTE EDITADO", domicilio: "Domicilio editado" })
                .where(and(eq(clientesTable.id, clienteId), eq(clientesTable.user, userId)));
            await db
                .update(librosTable)
                .set({ titulo: "Título editado" })
                .where(and(eq(librosTable.isbn, isbnLibro), eq(librosTable.user, userId)));
            await db
                .update(usersTable)
                .set({ razon_social: "EDITORIAL EDITADA" })
                .where(eq(usersTable.id, userId));

            const res = await auth(request(app).get(`/comprobantes/${venta.comprobante.id}`));
            expect(res.status).toBe(200);
            expect(res.body.data.receptor.razonSocial).toBe(clienteAntes.razon_social);
            expect(res.body.data.emisor.razonSocial).toBe(userAntes.razon_social);
            expect(res.body.data.items[0].titulo).toBe(libroAntes.titulo);
        } finally {
            await db
                .update(clientesTable)
                .set({ razon_social: clienteAntes.razon_social, domicilio: clienteAntes.domicilio })
                .where(and(eq(clientesTable.id, clienteId), eq(clientesTable.user, userId)));
            await db
                .update(librosTable)
                .set({ titulo: libroAntes.titulo })
                .where(and(eq(librosTable.isbn, isbnLibro), eq(librosTable.user, userId)));
            await db
                .update(usersTable)
                .set({ razon_social: userAntes.razon_social })
                .where(eq(usersTable.id, userId));
        }
    });
});

describe("remito", () => {
    it("crea una fila en comprobantes sin fila en facturas y no se reintenta", async () => {
        const cliente = await crearCliente("Cliente remito test", cuit(8504));
        await crearLibro(isbn(8504), "Libro remito test", 3);

        const res = await auth(
            request(app).post("/consignacion/").send({
                cliente,
                libros: [{ isbn: isbn(8504), cantidad: 2 }]
            })
        );
        expect(res.status).toBe(201);
        expect(res.body.data.comprobante).toMatchObject({
            clase: "remito",
            estado: "emitida",
            tipo: null,
            numero: res.body.data.id
        });

        const [factura] = await db
            .select()
            .from(facturasTable)
            .where(eq(facturasTable.comprobante_id, res.body.data.comprobante.id));
        expect(factura).toBeUndefined();

        const dto = await auth(request(app).get(`/comprobantes/${res.body.data.comprobante.id}`));
        expect(dto.status).toBe(200);
        expect(dto.body.data).toMatchObject({
            clase: "remito",
            tipo: null,
            cae: null,
            qr: null,
            resultado: null,
            numeroCompleto: expect.stringMatching(/^0003\/\d{5}$/)
        });

        const reintento = await auth(
            request(app).post(`/comprobantes/${res.body.data.comprobante.id}/reintentar`)
        );
        expect(reintento.status).toBe(409);
    });
});

describe("reintento de AFIP", () => {
    const afipRoto = createMockAfipService({
        getClient: () => {
            throw new Error("AFIP no configurado");
        }
    });
    const appRoto = createApp(createContainer({ afipService: afipRoto }));

    it("la venta persiste, el comprobante queda en error y se reintenta sobre el mismo id", async () => {
        const cliente = await crearCliente("Cliente reintento", cuit(8505));
        await crearLibro(isbn(8505), "Libro reintento", 3);

        const venta = await crearVenta(cliente, isbn(8505), 1, appRoto);
        expect(venta.comprobante).toMatchObject({ estado: "error", numero: null });

        const detalleVenta = await auth(request(app).get(`/venta/${venta.id}`));
        expect(detalleVenta.status).toBe(200);
        expect(detalleVenta.body.data.comprobante).toMatchObject({ estado: "error" });

        const errorDto = await auth(request(app).get(`/comprobantes/${venta.comprobante.id}`));
        expect(errorDto.body.data.error).toEqual({
            codigo: null,
            mensaje: "AFIP no configurado"
        });

        const falla = await auth(
            request(appRoto).post(`/comprobantes/${venta.comprobante.id}/reintentar`)
        );
        expect(falla.status).toBe(502);

        const reintento = await auth(
            request(app).post(`/comprobantes/${venta.comprobante.id}/reintentar`)
        );
        expect(reintento.status).toBe(200);
        expect(reintento.body.data).toMatchObject({
            id: venta.comprobante.id,
            estado: "emitida",
            cae: expect.any(String),
            error: null
        });

        const numero = reintento.body.data.numero;
        const repetido = await auth(
            request(app).post(`/comprobantes/${venta.comprobante.id}/reintentar`)
        );
        expect(repetido.status).toBe(200);
        expect(repetido.body.data.numero).toBe(numero);

        expect(
            (await auth(request(app).post(`/comprobantes/${venta.comprobante.id}/reintentar`), otroToken)).status
        ).toBe(404);
        expect(
            (await auth(request(app).post("/comprobantes/999999999/reintentar"))).status
        ).toBe(404);
        expect(
            (await request(app).post(`/comprobantes/${venta.comprobante.id}/reintentar`)).status
        ).toBe(401);
    });

    it("si AFIP emitió pero la respuesta se perdió, el reintento adopta el mismo comprobante", async () => {
        const cliente = await crearCliente("Cliente timeout", cuit(8507));
        await crearLibro(isbn(8507), "Libro timeout", 3);

        const emitidos = new Map<string, ComprobanteAfip>();
        let numero = 500000;
        let emisiones = 0;
        const afip: IAfip = {
            getLastVoucher: async () => numero++,
            createVoucher: async (data) => {
                emisiones += 1;
                const cae = `CAE-${data.CbteDesde}`;
                emitidos.set(`${data.PtoVta}:${data.CbteTipo}:${data.CbteDesde}`, {
                    CbteNro: data.CbteDesde,
                    PtoVta: data.PtoVta,
                    CbteTipo: data.CbteTipo,
                    CbteFch: String(data.CbteFch),
                    CAE: cae,
                    CAEFchVto: "20260101",
                    Resultado: "A",
                    MonId: "PES",
                    ImpTotal: data.ImpTotal,
                    DocTipo: data.DocTipo,
                    DocNro: data.DocNro
                });
                return { CAE: cae, CAEFchVto: "20260101" };
            },
            getVoucherInfo: async (nro, ptoVenta, tipoCbte) =>
                emitidos.get(`${ptoVenta}:${tipoCbte}:${Number(nro)}`) ?? null
        };

        const base = createMockAfipService({ getClient: () => afip });
        const appPierdeRespuesta = createApp(
            createContainer({
                afipService: createMockAfipService({
                    ...base,
                    getClient: () => afip,
                    facturar: async (input) => {
                        await facturar(input);
                        throw new Error("timeout de red");
                    }
                })
            })
        );
        const appReconcilia = createApp(createContainer({ afipService: base }));

        const venta = await crearVenta(cliente, isbn(8507), 1, appPierdeRespuesta);
        expect(venta.comprobante.estado).toBe("error");
        expect(emisiones).toBe(1);

        const reintento = await auth(
            request(appReconcilia).post(`/comprobantes/${venta.comprobante.id}/reintentar`)
        );
        expect(reintento.status).toBe(200);
        expect(reintento.body.data).toMatchObject({
            estado: "emitida",
            cae: expect.stringMatching(/^CAE-/),
            numero: expect.any(Number)
        });
        // No se emitió un segundo comprobante: se adoptó el que AFIP ya tenía.
        expect(emisiones).toBe(1);
    });

    it("dos reintentos concurrentes generan una sola emisión", async () => {
        const cliente = await crearCliente("Cliente concurrencia", cuit(8506));
        await crearLibro(isbn(8506), "Libro concurrencia", 3);
        const venta = await crearVenta(cliente, isbn(8506), 1, appRoto);
        expect(venta.comprobante.estado).toBe("error");

        let llamadas = 0;
        const afipContador = createMockAfipService({
            facturar: async (input) => {
                llamadas += 1;
                return facturar(input);
            }
        });
        const appContador = createApp(createContainer({ afipService: afipContador }));

        const [primera, segunda] = await Promise.all([
            auth(request(appContador).post(`/comprobantes/${venta.comprobante.id}/reintentar`)),
            auth(request(appContador).post(`/comprobantes/${venta.comprobante.id}/reintentar`))
        ]);

        expect([primera.status, segunda.status]).toEqual([200, 200]);
        expect(primera.body.data.numero).toBe(segunda.body.data.numero);
        expect(llamadas).toBe(1);
    });
});

describe("constraints de la base", () => {
    const comprobanteBase = (
        movimientoId: number,
        overrides: Partial<typeof comprobantesTable.$inferInsert> = {}
    ): typeof comprobantesTable.$inferInsert => ({
        user: userId,
        tipo: "factura_c",
        movimiento_id: movimientoId,
        punto_venta: 1,
        emisor: emisorSnapshot(),
        receptor: receptorSnapshot(),
        items: [],
        ...overrides
    });

    it("no permite dos comprobantes para el mismo movimiento", async () => {
        const isbnUnico = isbn(8508);
        await crearLibro(isbnUnico, "Libro constraint movimiento");
        const movimiento = await cargarStockPrincipal(app, token, isbnUnico, 1);
        const values = comprobanteBase(movimiento.body.data.id);

        await db.insert(comprobantesTable).values(values);
        await expect(db.insert(comprobantesTable).values(values)).rejects.toThrow();
    });

    it("no repite numeración dentro del mismo tipo y punto de venta", async () => {
        const isbnA = isbn(8509);
        const isbnB = isbn(8510);
        await crearLibro(isbnA, "Libro numeración A");
        await crearLibro(isbnB, "Libro numeración B");
        const movimientoA = await cargarStockPrincipal(app, token, isbnA, 1);
        const movimientoB = await cargarStockPrincipal(app, token, isbnB, 1);
        const numero = 987654;

        await db.insert(comprobantesTable).values(
            comprobanteBase(movimientoA.body.data.id, { numero })
        );
        await expect(
            db.insert(comprobantesTable).values(
                comprobanteBase(movimientoB.body.data.id, { numero })
            )
        ).rejects.toThrow();
    });

    it("no permite una factura sin comprobante base ni un movimiento de otra cuenta", async () => {
        await expect(
            db.insert(facturasTable).values({ comprobante_id: 999999999, codigo_afip: 11 })
        ).rejects.toThrow();

        const isbnOtro = isbn(8511);
        const loginOtro = await request(app)
            .post("/user/login")
            .send({ username: "editorial_norte", password: PASSWORD_SEED });
        const libroOtro = await request(app)
            .post("/libro/")
            .set("Authorization", `Bearer ${loginOtro.body.token}`)
            .send({ isbn: isbnOtro, titulo: "Libro otra cuenta", fecha_edicion: "2020-01-01", precio: 1000 });
        expect(libroOtro.status).toBe(201);
        const stockOtro = await cargarStockPrincipal(app, loginOtro.body.token, isbnOtro, 1);
        expect(stockOtro.status).toBe(201);

        const [movimientoOtro] = await db
            .select({ id: movimientosTable.id })
            .from(movimientosTable)
            .where(and(eq(movimientosTable.id, stockOtro.body.data.id), eq(movimientosTable.user, userId)));
        expect(movimientoOtro).toBeUndefined();

        await expect(
            db.insert(comprobantesTable).values(
                comprobanteBase(stockOtro.body.data.id, { user: userId })
            )
        ).rejects.toThrow();
    });
});

describe("archivos públicos", () => {
    const facturaPath = join(env.FILES_PATH, "facturas", "bloqueada.pdf");
    const remitoPath = join(env.FILES_PATH, "remitos", "bloqueada.pdf");
    const etiquetaPath = join(env.FILES_PATH, "etiquetas", "bloqueada.pdf");
    const logoPath = join(env.FILES_PATH, "logos", "publico.txt");

    beforeAll(() => {
        for (const path of [facturaPath, remitoPath, etiquetaPath, logoPath]) {
            fs.mkdirSync(join(path, ".."), { recursive: true });
            fs.writeFileSync(path, "contenido");
        }
    });

    afterAll(() => {
        for (const path of [facturaPath, remitoPath, etiquetaPath, logoPath]) {
            fs.rmSync(path, { force: true });
        }
    });

    it("bloquea facturas, remitos y etiquetas y mantiene públicos logos/portadas", async () => {
        for (const path of ["/files/facturas/bloqueada.pdf", "/files/remitos/bloqueada.pdf", "/files/etiquetas/bloqueada.pdf"]) {
            const res = await request(app).get(path);
            expect(res.status).toBe(404);
        }

        const logo = await request(app).get("/files/logos/publico.txt");
        expect(logo.status).toBe(200);
    });
});
