import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import request from "supertest";
import { and, eq } from "drizzle-orm";
import * as dotenv from 'dotenv';
import { join } from "path";
import fs from "fs";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { movimientosTable, movimientosLibrosTable } from '../src/modules/movimiento/movimiento.schema';
import { depositoLibrosTable } from '../src/modules/deposito/depositoLibros.schema';
import { librosTable } from '../src/modules/libro/libro.schema';
import { diaDeFecha, inicioDelMes, mesAnterior, mesDeFecha, resolverPeriodo, ultimoDiaDelMes, ultimosMeses } from '../src/modules/metricas/metricas.periodo';
import { expectBadRequest, expectDataResponse, getMedioPagoId } from './util';
import { cuit, isbn } from '../seeders/data';

const container = createContainer({ afipService: createMockAfipService(), comprobanteService: createMockComprobanteService() });
const app = createApp(container);

// Meses cerrados y fijos: el test no depende de la fecha de hoy para estas
// cifras. El mes en curso se prueba aparte, calculado desde el reloj.
const MES_A = "2024-03";
const MES_B = "2024-02";
const MES_VACIO = "2023-12";

const ZONA = "-03:00";
const enFecha = (fecha: string): Date => new Date(`${fecha}T12:00:00${ZONA}`);
const dosDigitos = (n: number): string => String(n).padStart(2, "0");
const formatearDia = (mes: string, dia: number): string => `${mes}-${dosDigitos(dia)}`;
const redondear2 = (n: number): number => Math.round(n * 100) / 100;

const USUARIO = { username: "metricas_test", password: "metricas123", cuit: "20480000031", email: "metricas@test.com" };
const USUARIO_VACIO = { username: "metricas_vacio", password: "metricas123", cuit: "20480000032", email: "metricas-vacio@test.com" };

let token: string;
let tokenVacio: string;
let userId: number;
let principalId: number;
let efectivoId: number;
let transferenciaId: number;
let clienteA: number;
let clienteB: number;
let libro1: any;
let libro2: any;
let libro3: any;

const auth = () => ({ Authorization: `Bearer ${token}` });

const registrar = async (usuario: typeof USUARIO): Promise<{ token: string; userId: number }> => {
    const alta = await request(app).post('/user/register').send(usuario);
    expectDataResponse(alta, 201);
    // Punto de venta obligatorio para poder vender (ver operacion.service.ts).
    const actualizado = await container.user.service.update(alta.body.data.id, { punto_venta: 1 });
    expect(actualizado.changed).toBe(true);

    const login = await request(app).post('/user/login').send({ username: usuario.username, password: usuario.password });
    return { token: login.body.token, userId: alta.body.data.id };
};

const crearLibro = async (isbnLibro: string, precio: number) => {
    const res = await request(app)
        .post('/libro/')
        .set(auth())
        .send({ isbn: isbnLibro, titulo: `Metricas ${isbnLibro}`, fecha_edicion: '2020-01-01', precio });
    expectDataResponse(res, 201);
    return res.body.data;
};

const cargarStock = async (idLibro: number, cantidad: number): Promise<void> => {
    await db.insert(depositoLibrosTable).values({ deposito_id: principalId, id_libro: idLibro, cantidad, user: userId });
};

const insertarIngreso = async (idLibro: number, cantidad: number, fecha: Date, esMigracion: boolean): Promise<number> => {
    const [movimiento] = await db
        .insert(movimientosTable)
        .values({
            fecha,
            tipo: "ingreso",
            origen_tipo: "exterior",
            destino_tipo: "deposito",
            destino_deposito_id: principalId,
            es_migracion: esMigracion,
            user: userId
        })
        .returning();

    await db.insert(movimientosLibrosTable).values({ movimiento_id: movimiento.id, id_libro: idLibro, cantidad, precio: null, user: userId });

    return movimiento.id;
};

const moverFecha = async (idMovimiento: number, fecha: Date): Promise<void> => {
    await db.update(movimientosTable).set({ fecha }).where(and(eq(movimientosTable.id, idMovimiento), eq(movimientosTable.user, userId)));
};

const crearVenta = async (body: Record<string, unknown>) => {
    const res = await request(app).post('/venta/').set(auth()).send({ tipo_cbte: 11, ...body });
    expectDataResponse(res, 201);
    return res.body.data;
};

const getMetricas = (ruta: string, query: string, t = token) =>
    request(app).get(`/metricas/${ruta}?${query}`).set({ Authorization: `Bearer ${t}` });

const sumaCorte = (filas: { ejemplares: number; ingreso: number }[], campo: 'ejemplares' | 'ingreso'): number =>
    redondear2(filas.reduce((acc, fila) => acc + fila[campo], 0));

afterAll(() => {
    db.$client.end();
});

beforeAll(async () => {
    for (const usuario of [USUARIO, USUARIO_VACIO]) {
        fs.rmSync(join(__dirname, "../afipkeys/", usuario.cuit), { recursive: true, force: true });
    }

    const principal = await registrar(USUARIO);
    token = principal.token;
    userId = principal.userId;

    const vacio = await registrar(USUARIO_VACIO);
    tokenVacio = vacio.token;

    const depositos = await request(app).get('/deposito/').set(auth());
    principalId = depositos.body.data.find((d: { principal: boolean }) => d.principal).id;

    efectivoId = await getMedioPagoId(app, token, 'efectivo');
    transferenciaId = await getMedioPagoId(app, token, 'transferencia');

    const clienteRes = async (nombre: string, cuitCliente: string) => {
        const res = await request(app).post('/cliente/').set(auth()).send({ nombre, cuit: cuitCliente });
        expectDataResponse(res, 201);
        return res.body.data.id;
    };
    clienteA = await clienteRes('Cliente metricas A', cuit(9801));
    clienteB = await clienteRes('Cliente metricas B', cuit(9802));

    libro1 = await crearLibro(isbn(9910), 100);
    libro2 = await crearLibro(isbn(9911), 50);
    libro3 = await crearLibro(isbn(9912), 25);
    await cargarStock(libro1.id_libro, 1000);
    await cargarStock(libro2.id_libro, 1000);
    await cargarStock(libro3.id_libro, 1000);

    // S1 (firme, 10% de descuento): total 225 (250 menos 10%).
    const s1 = await crearVenta({
        cliente: clienteA,
        medio_pago: efectivoId,
        descuento: 10,
        libros: [{ isbn: libro1.isbn, cantidad: 2 }, { isbn: libro2.isbn, cantidad: 1 }]
    });
    await moverFecha(s1.id, enFecha(`${MES_A}-10`));
    expect(s1.total).toBe(225);

    // S2 (firme): total 300.
    const s2 = await crearVenta({
        cliente: clienteB,
        medio_pago: transferenciaId,
        libros: [{ isbn: libro1.isbn, cantidad: 3 }]
    });
    await moverFecha(s2.id, enFecha(`${MES_A}-20`));
    expect(s2.total).toBe(300);

    // S3 (sobre consignación): consignación previa al depósito del cliente.
    const consignacion = await request(app)
        .post('/consignacion/')
        .set(auth())
        .send({ cliente: clienteA, libros: [{ isbn: libro3.isbn, cantidad: 10 }] });
    expectDataResponse(consignacion, 201);

    const s3 = await request(app)
        .post('/ventaConsignacion/')
        .set(auth())
        .send({
            cliente: clienteA,
            medio_pago: efectivoId,
            tipo_cbte: 11,
            fecha_venta: new Date().toISOString(),
            libros: [{ isbn: libro3.isbn, cantidad: 4 }]
        });
    expectDataResponse(s3, 201);
    await moverFecha(s3.body.data.id, enFecha(`${MES_A}-15`));
    expect(s3.body.data.total).toBe(100);

    // S4 (firme) en el mes anterior: base de comparación del mes cerrado.
    const s4 = await crearVenta({ cliente: clienteA, medio_pago: efectivoId, libros: [{ isbn: libro1.isbn, cantidad: 1 }] });
    await moverFecha(s4.id, enFecha(`${MES_B}-05`));

    // Ingresos de stock: reales cuentan, los de la migración no.
    await insertarIngreso(libro1.id_libro, 5, enFecha(`${MES_A}-08`), false);
    await insertarIngreso(libro1.id_libro, 3, enFecha(`${MES_B}-08`), false);
    await insertarIngreso(libro2.id_libro, 50, enFecha(`${MES_A}-09`), true);
    await insertarIngreso(libro1.id_libro, 999, enFecha(`${MES_VACIO}-15`), true);

    // Mes en curso: una venta hoy y otra el día 1 del mes anterior (comparación
    // por el mismo tramo de días).
    await crearVenta({ cliente: clienteA, medio_pago: efectivoId, libros: [{ isbn: libro1.isbn, cantidad: 1 }] });

    const anterior = mesAnterior(mesDeFecha(new Date()));
    const s6 = await crearVenta({ cliente: clienteA, medio_pago: efectivoId, libros: [{ isbn: libro1.isbn, cantidad: 1 }] });
    await moverFecha(s6.id, enFecha(`${anterior}-01`));
});

describe('GET /metricas/meses', () => {
    test('devuelve los meses con datos y el mes en curso, descendente y en formato YYYY-MM', async () => {
        const res = await getMetricas('meses', '');

        expect(res.status).toBe(200);
        const meses: string[] = res.body.data.meses;
        const enCurso = mesDeFecha(new Date());

        for (const mes of meses) expect(mes).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect([...meses].sort().reverse()).toEqual(meses);
        expect(meses).toContain(enCurso);
        expect(meses).toContain(MES_A);
        expect(meses).toContain(MES_B);
    });

    test('no incluye un mes que sólo tiene un ingreso de la migración', async () => {
        const res = await getMetricas('meses', '');

        expect(res.body.data.meses).not.toContain(MES_VACIO);
    });

    test('un mes sin ventas ni ingresos no aparece', async () => {
        const res = await getMetricas('meses', '');

        expect(res.body.data.meses).not.toContain('2021-07');
    });

    test('sin token responde 403 y con token inválido 401 (auth compartida)', async () => {
        expect((await request(app).get('/metricas/meses')).status).toBe(403);
        expect((await request(app).get('/metricas/meses').set({ Authorization: 'Bearer roto' })).status).toBe(401);
    });

    test('sólo ve los meses de su cuenta', async () => {
        const res = await getMetricas('meses', '', tokenVacio);

        expect(res.body.data.meses).toEqual([mesDeFecha(new Date())]);
    });
});

describe('GET /metricas/resumen', () => {
    test('mes cerrado: cuatro cifras actuales y anteriores (mes anterior completo)', async () => {
        const res = await getMetricas('resumen', `mes=${MES_A}`);

        expect(res.status).toBe(200);
        expect(res.body.data.periodo).toEqual({ mes: MES_A, desde: `${MES_A}-01`, hasta: `${MES_A}-31`, enCurso: false });
        expect(res.body.data.comparacion).toEqual({ mes: MES_B, desde: `${MES_B}-01`, hasta: `${MES_B}-29`, parcial: false });
        expect(res.body.data.cifras).toEqual({
            ingreso: { actual: 625, anterior: 100 },
            ejemplares: { actual: 10, anterior: 1 },
            ventas: { actual: 3, anterior: 1 },
            ejemplaresNuevos: { actual: 5, anterior: 3 }
        });
    });

    test('el ingreso usa el total de la venta con descuento, no la suma de las líneas', async () => {
        const res = await getMetricas('resumen', `mes=${MES_A}`);

        // líneas de S1: 2×100 + 1×50 = 250; el total con 10% de descuento es 225.
        expect(res.body.data.cifras.ingreso.actual).toBe(625);
        expect(res.body.data.cifras.ingreso.actual).not.toBe(650);
    });

    test('el alcance acota el comercial pero no los ejemplares nuevos', async () => {
        const firme = await getMetricas('resumen', `mes=${MES_A}&alcance=firme`);
        const consignacion = await getMetricas('resumen', `mes=${MES_A}&alcance=consignacion`);

        expect(firme.body.data.cifras).toMatchObject({
            ingreso: { actual: 525 },
            ejemplares: { actual: 6 },
            ventas: { actual: 2 },
            ejemplaresNuevos: { actual: 5 }
        });
        expect(consignacion.body.data.cifras).toMatchObject({
            ingreso: { actual: 100 },
            ejemplares: { actual: 4 },
            ventas: { actual: 1 },
            ejemplaresNuevos: { actual: 5 }
        });
    });

    test('mes válido sin datos: 200 con todo en cero (y sin ejemplares nuevos de la migración)', async () => {
        const res = await getMetricas('resumen', `mes=${MES_VACIO}`);

        expect(res.status).toBe(200);
        expect(res.body.data.cifras).toEqual({
            ingreso: { actual: 0, anterior: 0 },
            ejemplares: { actual: 0, anterior: 0 },
            ventas: { actual: 0, anterior: 0 },
            ejemplaresNuevos: { actual: 0, anterior: 0 }
        });
    });

    test('mes en curso: se compara el mismo tramo de días del mes anterior', async () => {
        const enCurso = mesDeFecha(new Date());
        const anterior = mesAnterior(enCurso);
        const hoy = diaDeFecha(new Date());
        const hastaComparado = Math.min(hoy, ultimoDiaDelMes(anterior));

        const res = await getMetricas('resumen', `mes=${enCurso}`);

        expect(res.body.data.periodo).toEqual({
            mes: enCurso,
            desde: `${enCurso}-01`,
            hasta: formatearDia(enCurso, hoy),
            enCurso: true
        });
        expect(res.body.data.comparacion).toEqual({
            mes: anterior,
            desde: `${anterior}-01`,
            hasta: formatearDia(anterior, hastaComparado),
            parcial: true
        });
        expect(res.body.data.cifras.ingreso).toEqual({ actual: 100, anterior: 100 });
        expect(res.body.data.cifras.ventas).toEqual({ actual: 1, anterior: 1 });
    });

    test('mes o alcance inválidos devuelven 400', async () => {
        expectBadRequest(await getMetricas('resumen', ''));
        expectBadRequest(await getMetricas('resumen', 'mes=2026-13'));
        expectBadRequest(await getMetricas('resumen', `mes=${MES_A}&alcance=otro`));
    });

    test('sólo suma datos de la cuenta autenticada', async () => {
        const vacio = await getMetricas('resumen', `mes=${MES_A}`, tokenVacio);

        expect(vacio.body.data.cifras.ingreso).toEqual({ actual: 0, anterior: 0 });
    });
});

describe('GET /metricas/cortes', () => {
    test('devuelve los tres cortes con sus identificadores y campos', async () => {
        const res = await getMetricas('cortes', `mes=${MES_A}`);

        expect(res.status).toBe(200);
        const { titulo, cliente, deposito } = res.body.data;

        const l1 = titulo.find((f: any) => f.isbn === libro1.isbn);
        expect(l1).toMatchObject({ titulo: libro1.titulo, ejemplares: 5, ingreso: 480, ventas: 2 });

        const l2 = titulo.find((f: any) => f.isbn === libro2.isbn);
        expect(l2).toMatchObject({ ejemplares: 1, ingreso: 45, ventas: 1 });

        const a = cliente.find((f: any) => f.idCliente === clienteA);
        expect(a).toMatchObject({ cliente: 'Cliente metricas A', ejemplares: 7, ingreso: 325, ventas: 2 });

        const b = cliente.find((f: any) => f.idCliente === clienteB);
        expect(b).toMatchObject({ ejemplares: 3, ingreso: 300, ventas: 1 });

        const principal = deposito.find((f: any) => f.idDeposito === principalId);
        expect(principal).toMatchObject({ esDepositoCliente: false, idCliente: null, ejemplares: 6, ingreso: 525, ventas: 2 });

        const consignado = deposito.find((f: any) => f.esDepositoCliente);
        expect(consignado).toMatchObject({ ejemplares: 4, ingreso: 100, ventas: 1, idCliente: clienteA });
    });

    test('las porciones de cada corte suman 1 en ejemplares y en ingreso', async () => {
        const { titulo, cliente, deposito } = (await getMetricas('cortes', `mes=${MES_A}`)).body.data;

        for (const corte of [titulo, cliente, deposito]) {
            expect(corte.reduce((acc: number, fila: any) => acc + fila.porcionEjemplares, 0)).toBeCloseTo(1, 5);
            expect(corte.reduce((acc: number, fila: any) => acc + fila.porcionIngreso, 0)).toBeCloseTo(1, 5);
        }
    });

    test('el alcance filtra los tres cortes y un mes sin ventas los deja vacíos', async () => {
        const firme = (await getMetricas('cortes', `mes=${MES_A}&alcance=firme`)).body.data;
        const consignacion = (await getMetricas('cortes', `mes=${MES_A}&alcance=consignacion`)).body.data;
        const vacio = (await getMetricas('cortes', `mes=${MES_VACIO}`)).body.data;

        expect(firme.titulo.map((f: any) => f.isbn).sort()).toEqual([libro1.isbn, libro2.isbn].sort());
        expect(consignacion.titulo.map((f: any) => f.isbn)).toEqual([libro3.isbn]);
        expect(firme.deposito.every((f: any) => f.esDepositoCliente === false)).toBe(true);
        expect(consignacion.deposito.every((f: any) => f.esDepositoCliente === true)).toBe(true);

        expect(vacio).toEqual({ titulo: [], cliente: [], deposito: [] });
    });
});

describe('GET /metricas/serie', () => {
    test('devuelve 12 puntos, del más viejo al más nuevo, terminando en el mes elegido', async () => {
        const res = await getMetricas('serie', `mes=${MES_A}`);

        expect(res.status).toBe(200);
        expect(res.body.data.puntos).toHaveLength(12);
        expect(res.body.data.puntos[0].mes).toBe('2023-04');
        expect(res.body.data.puntos[11].mes).toBe(MES_A);
        expect(res.body.data.enCurso).toBe(false);

        const porMes = new Map<string, number>(res.body.data.puntos.map((p: any) => [p.mes, p.ingreso]));
        expect(porMes.get(MES_A)).toBe(625);
        expect(porMes.get(MES_B)).toBe(100);
        expect(porMes.get('2023-05')).toBe(0);
    });

    test('el punto del mes elegido coincide con el resumen', async () => {
        const serie = await getMetricas('serie', `mes=${MES_A}&alcance=firme`);
        const resumen = await getMetricas('resumen', `mes=${MES_A}&alcance=firme`);

        const ultimo = serie.body.data.puntos[serie.body.data.puntos.length - 1];
        expect(ultimo.ingreso).toBe(resumen.body.data.cifras.ingreso.actual);
        expect(ultimo.ingreso).toBe(525);
    });

    test('el mes en curso marca `enCurso` y su punto coincide con el resumen', async () => {
        const enCurso = mesDeFecha(new Date());
        const serie = await getMetricas('serie', `mes=${enCurso}`);
        const resumen = await getMetricas('resumen', `mes=${enCurso}`);

        expect(serie.body.data.enCurso).toBe(true);
        expect(serie.body.data.puntos[11]).toEqual({ mes: enCurso, ingreso: resumen.body.data.cifras.ingreso.actual });
    });

    test('sólo incluye datos de la cuenta', async () => {
        const vacio = await getMetricas('serie', `mes=${MES_A}`, tokenVacio);

        expect(vacio.body.data.puntos.every((p: any) => p.ingreso === 0)).toBe(true);
    });
});

describe('GET /metricas/medios-pago', () => {
    test('devuelve el ingreso del mes por medio de pago', async () => {
        const res = await getMetricas('medios-pago', `mes=${MES_A}`);

        expect(res.status).toBe(200);
        expect(res.body.data.medios).toEqual([
            { medio: 'efectivo', ingreso: 325 },
            { medio: 'transferencia', ingreso: 300 }
        ]);
    });

    test('con alcance firme excluye el medio de la venta sobre consignación', async () => {
        const res = await getMetricas('medios-pago', `mes=${MES_A}&alcance=firme`);

        expect(res.body.data.medios).toEqual([
            { medio: 'efectivo', ingreso: 225 },
            { medio: 'transferencia', ingreso: 300 }
        ]);
    });

    test('no aparecen medios sin ventas en el período', async () => {
        const res = await getMetricas('medios-pago', `mes=${MES_B}`);

        expect(res.body.data.medios).toEqual([{ medio: 'efectivo', ingreso: 100 }]);
    });

    test('sólo incluye datos de la cuenta', async () => {
        const res = await getMetricas('medios-pago', `mes=${MES_A}`, tokenVacio);

        expect(res.body.data.medios).toEqual([]);
    });
});

describe('resolución del período (hora local de Argentina)', () => {
    test('el mes y el día se leen en la zona de Argentina, no en UTC', async () => {
        // 02:00 UTC del 1/11 es 23:00 del 31/10 en Argentina.
        const instante = new Date('2026-11-01T02:00:00Z');

        expect(mesDeFecha(instante)).toBe('2026-10');
        expect(diaDeFecha(instante)).toBe(31);
    });

    test('un mes cerrado va completo y compara contra el mes anterior completo', () => {
        const resolucion = resolverPeriodo('2026-03', new Date('2026-10-16T12:00:00-03:00'));

        expect(resolucion.enCurso).toBe(false);
        expect(resolucion.periodo).toMatchObject({ desde: '2026-03-01', hasta: '2026-03-31' });
        expect(resolucion.comparacion).toMatchObject({ mes: '2026-02', desde: '2026-02-01', hasta: '2026-02-28' });
        expect(resolucion.comparacionParcial).toBe(false);
    });

    test('un febrero bisiesto llega hasta el 29', () => {
        const resolucion = resolverPeriodo('2024-03', new Date('2026-10-16T12:00:00-03:00'));

        expect(resolucion.comparacion).toMatchObject({ mes: '2024-02', hasta: '2024-02-29' });
    });

    test('el mes en curso se corta en el día de hoy y compara el mismo tramo', () => {
        const resolucion = resolverPeriodo('2026-10', new Date('2026-10-16T12:00:00-03:00'));

        expect(resolucion.enCurso).toBe(true);
        expect(resolucion.periodo).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-16' });
        expect(resolucion.comparacion).toMatchObject({ mes: '2026-09', desde: '2026-09-01', hasta: '2026-09-16' });
        expect(resolucion.comparacionParcial).toBe(true);
    });

    test('si el mes anterior es más corto, la comparación llega hasta su último día', () => {
        const resolucion = resolverPeriodo('2026-05', new Date('2026-05-31T12:00:00-03:00'));

        expect(resolucion.comparacion).toMatchObject({ mes: '2026-04', desde: '2026-04-01', hasta: '2026-04-30' });
        expect(resolucion.comparacionParcial).toBe(true);
    });

    test('los instantes de corte son el inicio/fin del día local', () => {
        const resolucion = resolverPeriodo('2026-10', new Date('2026-10-16T12:00:00-03:00'));

        // 00:00 del 1/10 en Argentina = 03:00 UTC.
        expect(resolucion.periodo.desdeInstante.toISOString()).toBe('2026-10-01T03:00:00.000Z');
        // 23:59:59.999 del 16/10 en Argentina = 02:59:59.999 UTC del 17/10.
        expect(resolucion.periodo.hastaInstante.toISOString()).toBe('2026-10-17T02:59:59.999Z');
        expect(inicioDelMes('2026-10').toISOString()).toBe('2026-10-01T03:00:00.000Z');
    });

    test('la serie de 12 meses termina en el mes elegido', () => {
        expect(ultimosMeses('2024-03', 12)).toEqual([
            '2023-04', '2023-05', '2023-06', '2023-07', '2023-08', '2023-09',
            '2023-10', '2023-11', '2023-12', '2024-01', '2024-02', '2024-03'
        ]);
    });
});

describe('coherencia entre las vistas (tarea 6)', () => {
    const vistas = async (mes: string, alcance: string) => {
        const [resumen, cortes, serie, medios] = await Promise.all([
            getMetricas('resumen', `mes=${mes}&alcance=${alcance}`),
            getMetricas('cortes', `mes=${mes}&alcance=${alcance}`),
            getMetricas('serie', `mes=${mes}&alcance=${alcance}`),
            getMetricas('medios-pago', `mes=${mes}&alcance=${alcance}`)
        ]);

        return {
            ingreso: resumen.body.data.cifras.ingreso.actual,
            ejemplares: resumen.body.data.cifras.ejemplares.actual,
            ventas: resumen.body.data.cifras.ventas.actual,
            nuevos: resumen.body.data.cifras.ejemplaresNuevos.actual,
            cortes: cortes.body.data,
            serie: serie.body.data.puntos,
            medios: medios.body.data.medios
        };
    };

    for (const alcance of ['todas', 'firme', 'consignacion']) {
        test(`con alcance=${alcance} el ingreso es el mismo en resumen, cortes, serie y medios`, async () => {
            const v = await vistas(MES_A, alcance);
            const ultimo = v.serie[v.serie.length - 1];

            expect(sumaCorte(v.cortes.titulo, 'ingreso')).toBe(v.ingreso);
            expect(sumaCorte(v.cortes.cliente, 'ingreso')).toBe(v.ingreso);
            expect(sumaCorte(v.cortes.deposito, 'ingreso')).toBe(v.ingreso);
            expect(ultimo.ingreso).toBe(v.ingreso);
            expect(redondear2(v.medios.reduce((acc: number, m: any) => acc + m.ingreso, 0))).toBe(v.ingreso);

            expect(sumaCorte(v.cortes.titulo, 'ejemplares')).toBe(v.ejemplares);
            expect(sumaCorte(v.cortes.cliente, 'ejemplares')).toBe(v.ejemplares);
            expect(sumaCorte(v.cortes.deposito, 'ejemplares')).toBe(v.ejemplares);
        });

        test(`con alcance=${alcance} ejemplares nuevos no cambia`, async () => {
            const v = await vistas(MES_A, alcance);

            expect(v.nuevos).toBe(5);
        });
    }

    test('la comparación de un mes cerrado usa el mismo alcance y período', async () => {
        const todas = await getMetricas('resumen', `mes=${MES_A}&alcance=todas`);
        const firme = await getMetricas('resumen', `mes=${MES_A}&alcance=firme`);

        expect(todas.body.data.comparacion).toEqual(firme.body.data.comparacion);
        expect(firme.body.data.cifras.ingreso.anterior).toBe(100);
    });
});

describe('migración 0010: el backfill marca los ingresos de la migración', () => {
    const leerBackfill = (): string => {
        const archivo = fs
            .readdirSync(join(__dirname, '../db/migrations'))
            .find((f) => f.startsWith('0010_') && f.endsWith('.sql'));
        const migracion = fs.readFileSync(join(__dirname, '../db/migrations', archivo as string), 'utf8');

        return migracion.split('--> statement-breakpoint').slice(1).join('--> statement-breakpoint').trim();
    };

    test('marca el ingreso reconstruido (cantidad = stock congelado) y no el ingreso real', async () => {
        const libroLegacy = await crearLibro(isbn(9913), 10);
        // `libros.stock` quedó congelado desde la migración 0004: es la firma que
        // distingue al ingreso que reconstruyó el stock preexistente.
        await db.update(librosTable).set({ stock: 40 }).where(and(eq(librosTable.id_libro, libroLegacy.id_libro), eq(librosTable.user, userId)));

        const reconstruido = await insertarIngreso(libroLegacy.id_libro, 40, enFecha('2022-06-10'), false);
        const real = await insertarIngreso(libroLegacy.id_libro, 7, enFecha('2022-06-11'), false);

        const backfill = leerBackfill();
        await db.$client.query(backfill);
        await db.$client.query(backfill); // idempotente

        const marcados = await db
            .select({ id: movimientosTable.id, esMigracion: movimientosTable.es_migracion })
            .from(movimientosTable)
            .where(and(eq(movimientosTable.user, userId), eq(movimientosTable.tipo, 'ingreso')));

        expect(marcados.find((m) => m.id === reconstruido)?.esMigracion).toBe(true);
        expect(marcados.find((m) => m.id === real)?.esMigracion).toBe(false);
    });
});
