import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import request from "supertest";
import { and, eq } from "drizzle-orm";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { transaccionesTable } from '../src/modules/transaccion/transaccion.schema';
import { libroClienteTable } from '../src/modules/cliente/libroCliente.schema';
import { precioLibroClienteTable } from '../src/modules/cliente/precioLibroCliente.schema';
import { expectBadRequest, expectDataResponse, delay } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn, dni, cuit } from '../seeders/data';

const container = createContainer({ afipService: createMockAfipService(), comprobanteService: createMockComprobanteService() });
const app = createApp(container);

// Recorte propio (no seedeado) para no interferir/depender de los libros,
// personas y clientes que ya usan otros archivos de test.
const isbnA = isbn(9970); // vendido dos veces, con cambio de precio catálogo y de porcentaje en el medio
const isbnB = isbn(9971); // nunca vendido: no debe aparecer en `libros`
const isbnC = isbn(9972); // ventaConsignacion + devolucion en el rango
const isbnD = isbn(9973); // misma persona que isbnA, pero como ilustrador
const isbnE = isbn(9974); // sólo consignación (sin venta asociada): no debe aparecer
const isbnF = isbn(9975); // vendido, sin ninguna persona asociada

const dniP1 = dni(9970);
const dniP2 = dni(9971);
const dniP3 = dni(9972);

const fmtFecha = (d: Date): string => d.toISOString().slice(0, 10);
const hoy = new Date();
const desde = fmtFecha(new Date(hoy.getTime() - 24 * 60 * 60 * 1000));
const hasta = fmtFecha(new Date(hoy.getTime() + 24 * 60 * 60 * 1000));
const fueraDeRangoAntes = new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000);
const fueraDeRangoDespues = new Date(hoy.getTime() + 60 * 24 * 60 * 60 * 1000);

let token: string;
let userId: number;
let cliente: { id: number };
let libroA: any, libroB: any, libroC: any, libroD: any, libroE: any, libroF: any;
let personaP1: any, personaP2: any, personaP3: any;

afterAll(() => {
    db.$client.end();
});

async function moverFechaTransaccion(idTransaccion: number, fecha: Date) {
    await db
        .update(transaccionesTable)
        .set({ fecha })
        .where(and(eq(transaccionesTable.id, idTransaccion), eq(transaccionesTable.user, userId)));
}

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });
    token = res.body.token;

    const crearLibro = async (isbnLibro: string, precio: number) => {
        const r = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send({ isbn: isbnLibro, titulo: 'Test liquidacion', fecha_edicion: '2020-01-01', precio, stock: 100 });
        expectDataResponse(r, 201);
        return r.body.data;
    };

    libroA = await crearLibro(isbnA, 100);
    libroB = await crearLibro(isbnB, 10);
    libroC = await crearLibro(isbnC, 300);
    libroD = await crearLibro(isbnD, 50);
    libroE = await crearLibro(isbnE, 20);
    libroF = await crearLibro(isbnF, 40);

    userId = libroA.user;

    const crearPersona = async (nombre: string, dniPersona: string) => {
        const r = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre, dni: dniPersona });
        expectDataResponse(r, 201);
        return r.body.data;
    };

    personaP1 = await crearPersona('Autor/ilustrador liquidacion', dniP1);
    personaP2 = await crearPersona('Ilustrador liquidacion', dniP2);
    personaP3 = await crearPersona('Autor porcentaje 0', dniP3);

    // P1: autor de isbnA (10% inicial, luego se sube a 25% vigente) e
    // ilustrador de isbnD (30%). P2: ilustrador de isbnA (20%). P3: autor de
    // isbnC con porcentaje 0.
    await request(app).post(`/libro/${isbnA}/personas`).set('Authorization', `Bearer ${token}`)
        .send({ id_persona: personaP1.id, tipo: 'autor', porcentaje: 10 });
    await request(app).post(`/libro/${isbnA}/personas`).set('Authorization', `Bearer ${token}`)
        .send({ id_persona: personaP2.id, tipo: 'ilustrador', porcentaje: 20 });
    await request(app).post(`/libro/${isbnD}/personas`).set('Authorization', `Bearer ${token}`)
        .send({ id_persona: personaP1.id, tipo: 'ilustrador', porcentaje: 30 });
    await request(app).post(`/libro/${isbnC}/personas`).set('Authorization', `Bearer ${token}`)
        .send({ id_persona: personaP3.id, tipo: 'autor', porcentaje: 0 });

    const resCliente = await request(app)
        .post('/cliente/')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Cliente liquidacion', email: 'liquidacion@test.com', cuit: cuit(9970) });
    expectDataResponse(resCliente, 201);
    cliente = resCliente.body.data;
});

describe('GET /liquidacion: validación de rango de fechas', () => {
    test('sin desde ni hasta: 400', async () => {
        const res = await request(app).get('/liquidacion').set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
    });

    test('sin hasta: 400', async () => {
        const res = await request(app).get(`/liquidacion?desde=${desde}`).set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
    });

    test('fecha inválida (mes 13): 400', async () => {
        const res = await request(app)
            .get('/liquidacion?desde=2026-13-01&hasta=2026-01-31')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
    });

    test('desde posterior a hasta: 400', async () => {
        const res = await request(app)
            .get('/liquidacion?desde=2026-02-01&hasta=2026-01-01')
            .set('Authorization', `Bearer ${token}`);
        expectBadRequest(res);
    });

    test('parámetros válidos: 200', async () => {
        const res = await request(app)
            .get(`/liquidacion?desde=${desde}&hasta=${hasta}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});

describe('GET /liquidacion: rango sin ventas computables', () => {
    test('devuelve 200 con todo en cero/vacío', async () => {
        const res = await request(app)
            .get('/liquidacion?desde=2000-01-01&hasta=2000-01-31')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({
            total_facturado: 0,
            ejemplares_vendidos: 0,
            libros: [],
            personas: []
        });
    });
});

describe('GET /liquidacion: agregado de libros/personas del período', () => {
    // El usuario ya tiene datos de seed dentro del rango elegido (desde/hasta
    // cubren "hoy"): se toma una base antes de las ventas propias de este
    // describe y se compara por delta, no por total absoluto.
    let totalFacturadoBase = 0;
    let ejemplaresBase = 0;

    test('Preparar ventas/ventaConsignacion/devolucion/consignacion', async () => {
        const resBase = await request(app)
            .get(`/liquidacion?desde=${desde}&hasta=${hasta}`)
            .set('Authorization', `Bearer ${token}`);
        totalFacturadoBase = resBase.body.data.total_facturado;
        ejemplaresBase = resBase.body.data.ejemplares_vendidos;

        // Venta 1: isbnA (precio catálogo 100) e isbnD (precio 50).
        const venta1 = await request(app)
            .post('/venta/')
            .set('Authorization', `Bearer ${token}`)
            .send({
                cliente: cliente.id,
                medio_pago: 'efectivo',
                tipo_cbte: 11,
                libros: [{ isbn: isbnA, cantidad: 5 }, { isbn: isbnD, cantidad: 2 }]
            });
        expectDataResponse(venta1, 201);

        // Sube el precio catálogo de isbnA: la venta 2 debe quedar con precio
        // histórico distinto al de la venta 1 (200), y ambos distintos del
        // precio catálogo final.
        const putPrecio = await request(app)
            .put(`/libro/${isbnA}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ precio: 200 });
        expect(putPrecio.status).toBe(200);

        // Sube el porcentaje vigente de P1 sobre isbnA: la liquidación debe
        // usar el 25% vigente para TODAS las ventas de isbnA del período, no
        // el 10% que tenía al momento de la venta 1.
        const putPorcentaje = await request(app)
            .put(`/libro/${isbnA}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaP1.id, tipo: 'autor', porcentaje: 25 });
        expect(putPorcentaje.status).toBe(201);

        // Venta 2: isbnA a precio catálogo actualizado (200).
        const venta2 = await request(app)
            .post('/venta/')
            .set('Authorization', `Bearer ${token}`)
            .send({
                cliente: cliente.id,
                medio_pago: 'efectivo',
                tipo_cbte: 11,
                libros: [{ isbn: isbnA, cantidad: 4 }]
            });
        expectDataResponse(venta2, 201);

        // Venta 3: isbnF, sin ninguna persona asociada.
        const ventaF = await request(app)
            .post('/venta/')
            .set('Authorization', `Bearer ${token}`)
            .send({
                cliente: cliente.id,
                medio_pago: 'efectivo',
                tipo_cbte: 11,
                libros: [{ isbn: isbnF, cantidad: 3 }]
            });
        expectDataResponse(ventaF, 201);

        // isbnC: precarga manual de libro_cliente/precio_libro_cliente (mismo
        // patrón que test/venta_consignacion.test.ts) para poder vender en
        // consignación con un precio histórico conocido.
        await db.insert(libroClienteTable).values({
            id_cliente: cliente.id,
            id_libro: libroC.id_libro,
            isbn: isbnC,
            stock: 10,
            precio: 300
        });
        await db.insert(precioLibroClienteTable).values({
            id_cliente: cliente.id,
            id_libro: libroC.id_libro,
            precio: 300
        });
        await delay(1200);

        const ventaConsignacion = await request(app)
            .post('/ventaConsignacion/')
            .set('Authorization', `Bearer ${token}`)
            .send({
                cliente: cliente.id,
                libros: [{ isbn: isbnC, cantidad: 3 }],
                fecha_venta: new Date().toISOString(),
                medio_pago: 'efectivo',
                tipo_cbte: 11
            });
        expectDataResponse(ventaConsignacion, 201);
        expect(ventaConsignacion.body.data.total).toEqual(900); // precio histórico (300) x 3

        // Devolución de isbnC en el mismo rango: no debe modificar el agregado.
        const devolucion = await request(app)
            .post('/devolucion/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cliente: cliente.id, libros: [{ isbn: isbnC, cantidad: 1 }] });
        expect(devolucion.status).toBe(201);

        // Consignación (sin venta asociada) de isbnE: no debe aparecer en `libros`.
        const consignacion = await request(app)
            .post('/consignacion/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cliente: cliente.id, libros: [{ isbn: isbnE, cantidad: 5 }] });
        expect(consignacion.status).toBe(201);

        // Venta fuera de rango (antes de `desde`): no debe sumar a isbnA.
        const ventaAntes = await request(app)
            .post('/venta/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cliente: cliente.id, medio_pago: 'efectivo', tipo_cbte: 11, libros: [{ isbn: isbnA, cantidad: 1 }] });
        expectDataResponse(ventaAntes, 201);
        await moverFechaTransaccion(ventaAntes.body.data.id, fueraDeRangoAntes);

        // Venta fuera de rango (después de `hasta`): no debe sumar a isbnA.
        const ventaDespues = await request(app)
            .post('/venta/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cliente: cliente.id, medio_pago: 'efectivo', tipo_cbte: 11, libros: [{ isbn: isbnA, cantidad: 1 }] });
        expectDataResponse(ventaDespues, 201);
        await moverFechaTransaccion(ventaDespues.body.data.id, fueraDeRangoDespues);
    });

    test('libros: agregados correctos por libro', async () => {
        const res = await request(app)
            .get(`/liquidacion?desde=${desde}&hasta=${hasta}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);

        const libros = res.body.data.libros;
        const porIsbn = (isbnLibro: string) => libros.find((l: any) => l.isbn === isbnLibro);

        // isbnA: 5 (precio 100) + 4 (precio 200) = 9 unidades, importe 1300,
        // promedio ponderado 1300/9 = 144.44. No incluye las ventas fuera de
        // rango.
        const a = porIsbn(isbnA);
        expect(a).toBeDefined();
        expect(a.cantidad_vendida).toEqual(9);
        expect(a.importe_total).toEqual(1300);
        expect(a.precio_unitario).toEqual(144.44);

        // isbnD: una sola venta, sin ambigüedad de precio.
        const d = porIsbn(isbnD);
        expect(d).toBeDefined();
        expect(d.cantidad_vendida).toEqual(2);
        expect(d.importe_total).toEqual(100);
        expect(d.precio_unitario).toEqual(50);

        // isbnC: ventaConsignacion cuenta, devolucion no resta nada.
        const c = porIsbn(isbnC);
        expect(c).toBeDefined();
        expect(c.cantidad_vendida).toEqual(3);
        expect(c.importe_total).toEqual(900);
        expect(c.precio_unitario).toEqual(300);

        // isbnF: vendido sin personas asociadas, igual aparece en `libros`.
        const f = porIsbn(isbnF);
        expect(f).toBeDefined();
        expect(f.cantidad_vendida).toEqual(3);
        expect(f.importe_total).toEqual(120);

        // isbnB nunca se vendió; isbnE sólo tuvo una consignación (sin venta).
        expect(porIsbn(isbnB)).toBeUndefined();
        expect(porIsbn(isbnE)).toBeUndefined();

        expect(res.body.data.total_facturado).toEqual(totalFacturadoBase + 1300 + 100 + 900 + 120);
        expect(res.body.data.ejemplares_vendidos).toEqual(ejemplaresBase + 9 + 2 + 3 + 3);
    });

    test('personas: porcentaje vigente, participación en varios libros y porcentaje 0', async () => {
        const res = await request(app)
            .get(`/liquidacion?desde=${desde}&hasta=${hasta}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);

        const personas = res.body.data.personas;
        const porId = (id: number) => personas.find((p: any) => p.id_persona === id);

        // P1: autor de isbnA (25% vigente, no el 10% con el que se hizo la
        // venta 1) e ilustrador de isbnD (30%): una sola entrada, dos detalles.
        const p1 = porId(personaP1.id);
        expect(p1).toBeDefined();
        expect(p1.detalle).toHaveLength(2);

        const detalleA = p1.detalle.find((d: any) => d.id_libro === libroA.id_libro);
        expect(detalleA.tipo).toEqual('autor');
        expect(detalleA.porcentaje).toEqual(25);
        expect(detalleA.importe).toEqual(325); // 1300 * 25%

        const detalleD = p1.detalle.find((d: any) => d.id_libro === libroD.id_libro);
        expect(detalleD.tipo).toEqual('ilustrador');
        expect(detalleD.porcentaje).toEqual(30);
        expect(detalleD.importe).toEqual(30); // 100 * 30%

        expect(p1.total_a_pagar).toEqual(355);

        // P2: sólo ilustrador de isbnA (20%).
        const p2 = porId(personaP2.id);
        expect(p2).toBeDefined();
        expect(p2.detalle).toHaveLength(1);
        expect(p2.detalle[0].tipo).toEqual('ilustrador');
        expect(p2.detalle[0].importe).toEqual(260); // 1300 * 20%
        expect(p2.total_a_pagar).toEqual(260);

        // P3: porcentaje 0 sobre isbnC, igual aparece (no se excluye por
        // porcentaje nulo).
        const p3 = porId(personaP3.id);
        expect(p3).toBeDefined();
        expect(p3.detalle).toHaveLength(1);
        expect(p3.detalle[0].porcentaje).toEqual(0);
        expect(p3.detalle[0].importe).toEqual(0);
        expect(p3.total_a_pagar).toEqual(0);

        // isbnF no tiene personas asociadas: ninguna entrada de `personas`
        // referencia ese libro.
        for (const persona of personas) {
            expect(persona.detalle.some((d: any) => d.id_libro === libroF.id_libro)).toBe(false);
        }
    });
});

describe('GET /liquidacion: aislamiento por usuario', () => {
    test('la venta de otro usuario en el mismo rango no aparece en la liquidación', async () => {
        const resAntes = await request(app)
            .get(`/liquidacion?desde=${desde}&hasta=${hasta}`)
            .set('Authorization', `Bearer ${token}`);
        const totalAntes = resAntes.body.data.total_facturado;

        const resLoginOtro = await request(app)
            .post('/user/login')
            .send({ username: 'editorial_norte', password: PASSWORD_SEED });
        const tokenOtro = resLoginOtro.body.token;

        const isbnAjeno = isbn(9970); // mismo string que isbnA, pero bajo otro usuario: isbn es único por usuario.
        const resLibroAjeno = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${tokenOtro}`)
            .send({ isbn: isbnAjeno, titulo: 'Libro de otro usuario', fecha_edicion: '2020-01-01', precio: 999, stock: 100 });
        expectDataResponse(resLibroAjeno, 201);

        const resClienteAjeno = await request(app)
            .post('/cliente/')
            .set('Authorization', `Bearer ${tokenOtro}`)
            .send({ nombre: 'Cliente ajeno', email: 'ajeno@test.com', cuit: cuit(9971) });
        expectDataResponse(resClienteAjeno, 201);

        const ventaAjena = await request(app)
            .post('/venta/')
            .set('Authorization', `Bearer ${tokenOtro}`)
            .send({
                cliente: resClienteAjeno.body.data.id,
                medio_pago: 'efectivo',
                tipo_cbte: 11,
                libros: [{ isbn: isbnAjeno, cantidad: 10 }]
            });
        expectDataResponse(ventaAjena, 201);

        const resDespues = await request(app)
            .get(`/liquidacion?desde=${desde}&hasta=${hasta}`)
            .set('Authorization', `Bearer ${token}`);

        expect(resDespues.body.data.total_facturado).toEqual(totalAntes);
        expect(resDespues.body.data.libros.some((l: any) => l.titulo === 'Libro de otro usuario')).toBe(false);
    });
});
