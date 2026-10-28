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
import { movimientosTable } from '../src/modules/movimiento/movimiento.schema';
import { isbn, dni, cuit } from '../seeders/data';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectConflict, expectCreated, expectNotFound, cargarStockPrincipal, getMedioPagoId, getRolId } from './util';

const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

let token: string;
let otroToken: string;
let userId: number;
let rolAutor: number;
let rolIlustrador: number;
let efectivoId: number;
let clienteId: number;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);
const anio = new Date().getUTCFullYear();

const primerDiaMes = (): string => {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString().slice(0, 10);
};
const ultimoDiaMes = (): string => {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

const isbnA = isbn(9940); // precio 100
const isbnB = isbn(9941); // precio 200
const PERIODO = { desde: '2099-06-01', hasta: '2099-06-30' };
const FECHA_VENTAS = '2099-06-10';

let personaP1: { id: number };
let personaP2: { id: number };
let liquidacionId: number;
let liquidacionNuevaId: number;

type Pago = { id: number; monto: number; fecha: string; nota: string | null };
type PersonaFicha = {
    id_persona: number;
    total: number;
    detalle: { id_libro: number; importe: number }[];
    pagado: number;
    saldo: number;
    estado: string;
    pagos: Pago[];
};
type FichaLiquidacion = {
    id: number;
    codigo: string;
    desde: string;
    hasta: string;
    total: number;
    pagado: number;
    saldo: number;
    estado: string;
    personas: PersonaFicha[];
};
type LiquidacionListado = {
    id: number;
    codigo: string;
    desde: string;
    hasta: string;
    fecha_generacion: string;
    personas: number;
    total: number;
    pagado: number;
    saldo: number;
    estado: string;
};

afterAll(() => {
    db.$client.end();
});

const crearPersona = async (nombre: string, dniPersona: string) => {
    const res = await auth(request(app).post('/persona/').send({ nombre, dni: dniPersona }));
    expectCreated(res);
    return res.body.data as { id: number };
};

const crearLibro = async (isbnLibro: string, precio: number) => {
    const res = await auth(
        request(app).post('/libro/').send({ isbn: isbnLibro, titulo: 'Test liquidaciones', fecha_edicion: '2020-01-01', precio })
    );
    expectCreated(res);
    expect((await cargarStockPrincipal(app, token, isbnLibro, 100)).status).toBe(201);
    return res.body.data;
};

const moverFecha = async (idMovimiento: number, fecha: string) => {
    await db
        .update(movimientosTable)
        .set({ fecha: new Date(`${fecha}T12:00:00.000Z`) })
        .where(and(eq(movimientosTable.id, idMovimiento), eq(movimientosTable.user, userId)));
};

const listar = async (t = token): Promise<LiquidacionListado[]> => (await auth(request(app).get('/liquidaciones/'), t)).body;

const vender = async (isbnLibro: string, cantidad: number) => {
    const res = await auth(
        request(app).post('/venta/').send({ cliente: clienteId, medio_pago: efectivoId, tipo_cbte: 11, libros: [{ isbn: isbnLibro, cantidad }] })
    );
    expectCreated(res);
    return res.body.data.id as number;
};

beforeAll(async () => {
    const [res, otroRes] = await Promise.all([
        request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED })
    ]);
    token = res.body.token;
    otroToken = otroRes.body.token;
    rolAutor = await getRolId(app, token, 'autor');
    rolIlustrador = await getRolId(app, token, 'ilustrador');
    efectivoId = await getMedioPagoId(app, token, 'efectivo');

    const cliente = await auth(request(app).post('/cliente/').send({ nombre: 'Cliente liquidaciones', email: 'liq@test.com', cuit: cuit(9960) }));
    expectCreated(cliente);
    clienteId = cliente.body.data.id;

    const libroA = await crearLibro(isbnA, 100);
    await crearLibro(isbnB, 200);
    userId = libroA.user;

    personaP1 = await crearPersona('Persona liquidaciones 1', dni(9940));
    personaP2 = await crearPersona('Persona liquidaciones 2', dni(9941));

    await auth(request(app).post(`/libro/${isbnA}/personas`).send({ id_persona: personaP1.id, rol: rolAutor, porcentaje: 10 }));
    await auth(request(app).post(`/libro/${isbnA}/personas`).send({ id_persona: personaP2.id, rol: rolIlustrador, porcentaje: 20 }));
    await auth(request(app).post(`/libro/${isbnB}/personas`).send({ id_persona: personaP1.id, rol: rolAutor, porcentaje: 30 }));
});

describe('Seed de liquidaciones', () => {
    test('deja tres liquidaciones con sus estados (pagada, parcial y pendiente)', async () => {
        const liquidaciones = await listar();

        expect(liquidaciones).toHaveLength(3);
        expect(liquidaciones.map((l) => l.estado).sort()).toEqual(['pagada', 'parcial', 'pendiente']);
        expect(liquidaciones.map((l) => l.codigo).sort()).toEqual([`LQ-${anio}-0001`, `LQ-${anio}-0002`, `LQ-${anio}-0003`]);
    });

    test('la previsualización del mes en curso muestra datos y excluye lo ya liquidado', async () => {
        const res = await auth(request(app).get(`/liquidacion?desde=${primerDiaMes()}&hasta=${ultimoDiaMes()}`));
        expect(res.status).toBe(200);

        expect(res.body.data.excluidas.length).toBeGreaterThanOrEqual(3);
        expect(res.body.data.total_facturado).toBeGreaterThan(0);
    });

    test('generar la liquidación del mes en curso deja LQ-<año>-0004 y no se puede repetir', async () => {
        const res = await auth(request(app).post('/liquidaciones/').send({ desde: primerDiaMes(), hasta: ultimoDiaMes() }));
        expectCreated(res);
        expect(res.body.data.codigo).toBe(`LQ-${anio}-0004`);

        expectConflict(await auth(request(app).post('/liquidaciones/').send({ desde: primerDiaMes(), hasta: ultimoDiaMes() })));
    });
});

describe('Generar y cubrir ventas de un período', () => {
    test('crear ventas del período y previsualizarlas sin exclusiones', async () => {
        await moverFecha(await vender(isbnA, 5), FECHA_VENTAS);
        await moverFecha(await vender(isbnB, 2), FECHA_VENTAS);

        const res = await auth(request(app).get(`/liquidacion?desde=${PERIODO.desde}&hasta=${PERIODO.hasta}`));
        expect(res.status).toBe(200);
        expect(res.body.data.total_facturado).toBe(900);
        expect(res.body.data.ejemplares_vendidos).toBe(7);
        expect(res.body.data.excluidas).toEqual([]);
    });

    test('POST /liquidaciones/ persiste con el mismo cálculo del reporte y lo devuelve como ficha', async () => {
        const antes = await listar();
        const res = await auth(request(app).post('/liquidaciones/').send(PERIODO));
        expectCreated(res);

        const ficha = res.body.data as FichaLiquidacion;
        liquidacionId = ficha.id;

        expect(ficha.codigo).toBe(`LQ-${anio}-${String(antes.length + 1).padStart(4, '0')}`);
        expect(ficha).toMatchObject({ desde: PERIODO.desde, hasta: PERIODO.hasta, total: 270, pagado: 0, saldo: 270, estado: 'pendiente' });
        expect(ficha.personas).toHaveLength(2);

        const p1 = ficha.personas.find((p) => p.id_persona === personaP1.id)!;
        expect(p1.total).toBe(170); // 500 * 10% + 400 * 30%
        expect(p1.detalle).toHaveLength(2);
        const p2 = ficha.personas.find((p) => p.id_persona === personaP2.id)!;
        expect(p2.total).toBe(100); // 500 * 20%
    });

    test('las ventas del período quedan cubiertas: repetir da 409 y el reporte las excluye', async () => {
        expectConflict(await auth(request(app).post('/liquidaciones/').send(PERIODO)));

        const reporte = await auth(request(app).get(`/liquidacion?desde=${PERIODO.desde}&hasta=${PERIODO.hasta}`));
        expect(reporte.body.data.total_facturado).toBe(0);
        expect(reporte.body.data.libros).toEqual([]);
        expect(reporte.body.data.personas).toEqual([]);
        expect(reporte.body.data.excluidas).toHaveLength(1);
        expect(reporte.body.data.excluidas[0]).toMatchObject({ liquidacion_id: liquidacionId, ventas: 2 });
    });

    test('una venta nueva del mismo período se liquida sin volver a incluir las anteriores', async () => {
        await moverFecha(await vender(isbnA, 1), FECHA_VENTAS);

        const res = await auth(request(app).post('/liquidaciones/').send(PERIODO));
        expectCreated(res);
        liquidacionNuevaId = res.body.data.id;
        // Sólo entra la venta nueva (1 ejemplar de isbnA): 10% + 20% de 100.
        expect(res.body.data.total).toBe(30);
        expect(res.body.data.personas).toHaveLength(2);
    });

    test('listar devuelve código, período, personas, totales y estado', async () => {
        const propia = (await listar()).find((l) => l.id === liquidacionId);

        expect(propia).toMatchObject({
            id: liquidacionId,
            desde: PERIODO.desde,
            hasta: PERIODO.hasta,
            personas: 2,
            total: 270,
            pagado: 0,
            saldo: 270,
            estado: 'pendiente'
        });
        expect(propia.fecha_generacion).toBeDefined();
    });
});

describe('Pagos de una liquidación', () => {
    let pagoId: number;

    test('un pago menor al saldo queda registrado y la persona y la liquidación pasan a parcial', async () => {
        const res = await auth(
            request(app)
                .post(`/liquidaciones/${liquidacionId}/personas/${personaP1.id}/pagos`)
                .send({ monto: 100, fecha: FECHA_VENTAS, nota: 'a cuenta' })
        );
        expectCreated(res);

        const ficha = res.body.data as FichaLiquidacion;
        expect(ficha).toMatchObject({ pagado: 100, saldo: 170, estado: 'parcial' });
        const p1 = ficha.personas.find((p) => p.id_persona === personaP1.id)!;
        expect(p1).toMatchObject({ pagado: 100, saldo: 70, estado: 'parcial' });
        expect(p1.pagos).toHaveLength(1);
        expect(p1.pagos[0]).toMatchObject({ monto: 100, fecha: FECHA_VENTAS, nota: 'a cuenta' });
        expect(p1.pagos[0]).not.toHaveProperty('medio_pago');
        pagoId = p1.pagos[0].id;
    });

    test('monto mayor al saldo o monto <= 0 dan 400', async () => {
        const base = `/liquidaciones/${liquidacionId}/personas/${personaP1.id}/pagos`;
        const respuestas = await Promise.all([
            auth(request(app).post(base).send({ monto: 999, fecha: FECHA_VENTAS })),
            auth(request(app).post(base).send({ monto: 0, fecha: FECHA_VENTAS })),
            auth(request(app).post(base).send({ monto: -5, fecha: FECHA_VENTAS })),
            // El contrato no admite medio de pago: el body es estricto.
            auth(request(app).post(base).send({ monto: 10, fecha: FECHA_VENTAS, medio_pago: 1 }))
        ]);

        for (const res of respuestas) expect(res.status).toBe(400);
    });

    test('pagar a una persona que no pertenece a la liquidación da 404', async () => {
        const personaFuera = await crearPersona('Persona fuera', dni(9942));
        const res = await auth(
            request(app)
                .post(`/liquidaciones/${liquidacionId}/personas/${personaFuera.id}/pagos`)
                .send({ monto: 10, fecha: FECHA_VENTAS })
        );

        expectNotFound(res);
        expect(res.status).toBe(404);
    });

    test('anular un pago restituye el saldo y lo saca del listado; anularlo dos veces da 404', async () => {
        const res = await auth(request(app).delete(`/liquidaciones/${liquidacionId}/pagos/${pagoId}`));
        expect(res.status).toBe(200);

        const ficha = res.body.data as FichaLiquidacion;
        expect(ficha).toMatchObject({ pagado: 0, saldo: 270, estado: 'pendiente' });
        const p1 = ficha.personas.find((p) => p.id_persona === personaP1.id)!;
        expect(p1).toMatchObject({ pagado: 0, estado: 'pendiente' });
        expect(p1.pagos).toEqual([]);

        expectNotFound(await auth(request(app).delete(`/liquidaciones/${liquidacionId}/pagos/${pagoId}`)));
    });

    test('pagar el saldo de todas las personas deja la liquidación pagada', async () => {
        const p1 = await auth(
            request(app).post(`/liquidaciones/${liquidacionId}/personas/${personaP1.id}/pagos`).send({ monto: 170, fecha: FECHA_VENTAS })
        );
        expectCreated(p1);
        expect(p1.body.data.estado).toBe('parcial');

        const p2 = await auth(
            request(app).post(`/liquidaciones/${liquidacionId}/personas/${personaP2.id}/pagos`).send({ monto: 100, fecha: FECHA_VENTAS })
        );
        expectCreated(p2);
        expect(p2.body.data).toMatchObject({ pagado: 270, saldo: 0, estado: 'pagada' });
    });

    test('liquidación inexistente o pago inexistente dan 404', async () => {
        const liquidacionInexistente = await auth(
            request(app).post(`/liquidaciones/999999999/personas/${personaP1.id}/pagos`).send({ monto: 1, fecha: FECHA_VENTAS })
        );
        const pagoInexistente = await auth(request(app).delete('/liquidaciones/999999999/pagos/1'));
        const pagoDeOtraLiquidacion = await auth(request(app).delete(`/liquidaciones/${liquidacionNuevaId}/pagos/999999999`));

        for (const res of [liquidacionInexistente, pagoInexistente, pagoDeOtraLiquidacion]) expect(res.status).toBe(404);
    });
});

describe('Validación e aislamiento', () => {
    test('POST /liquidaciones/ sin fechas, inválidas o desde > hasta: 400', async () => {
        const sinHasta = await auth(request(app).post('/liquidaciones/').send({ desde: primerDiaMes() }));
        const invalidas = await auth(request(app).post('/liquidaciones/').send({ desde: '2026-13-01', hasta: '2026-13-31' }));
        const invertidas = await auth(request(app).post('/liquidaciones/').send({ desde: '2026-02-01', hasta: '2026-01-01' }));

        for (const res of [sinHasta, invalidas, invertidas]) expect(res.status).toBe(400);
    });

    test('un usuario nunca ve ni toca liquidaciones de otra cuenta', async () => {
        const propias = await listar();
        const ajenas = await listar(otroToken);
        const idsPropias = new Set(propias.map((l) => l.id));

        expect(ajenas.some((l) => idsPropias.has(l.id))).toBe(false);
        expectNotFound(await auth(request(app).get(`/liquidaciones/${ajenas[0].id}`)));
        expectNotFound(
            await auth(request(app).post(`/liquidaciones/${ajenas[0].id}/personas/${personaP1.id}/pagos`).send({ monto: 1, fecha: FECHA_VENTAS }))
        );
    });

    test('las ventas de otra cuenta no entran en la liquidación propia', async () => {
        const isbnAjeno = isbn(9955);
        const libroAjeno = await auth(
            request(app).post('/libro/').send({ isbn: isbnAjeno, titulo: 'Libro ajeno', fecha_edicion: '2020-01-01', precio: 500 }),
            otroToken
        );
        expectCreated(libroAjeno);
        expect((await cargarStockPrincipal(app, otroToken, isbnAjeno, 10)).status).toBe(201);

        const efectivoAjeno = await getMedioPagoId(app, otroToken, 'efectivo');
        const clienteAjeno = await auth(
            request(app).post('/cliente/').send({ nombre: 'Cliente ajeno liq', email: 'ajeno-liq@test.com', cuit: cuit(9961) }),
            otroToken
        );
        expectCreated(clienteAjeno);

        const ventaAjena = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteAjeno.body.data.id, medio_pago: efectivoAjeno, tipo_cbte: 11, libros: [{ isbn: isbnAjeno, cantidad: 2 }] }),
            otroToken
        );
        expectCreated(ventaAjena);

        // La venta ajena vive en un período propio: el reporte y la generación de esta cuenta no la ven.
        await db
            .update(movimientosTable)
            .set({ fecha: new Date('2099-07-05T12:00:00.000Z') })
            .where(and(eq(movimientosTable.id, ventaAjena.body.data.id), eq(movimientosTable.user, libroAjeno.body.data.user)));

        const periodo = { desde: '2099-07-01', hasta: '2099-07-31' };
        const reporte = await auth(request(app).get(`/liquidacion?desde=${periodo.desde}&hasta=${periodo.hasta}`));
        expect(reporte.body.data.total_facturado).toBe(0);
        expect(reporte.body.data.personas).toEqual([]);

        expectConflict(await auth(request(app).post('/liquidaciones/').send(periodo)));
    });
});
