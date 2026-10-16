import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import request from "supertest";
import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { isbn, dni } from '../seeders/data';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectBadRequest, expectConflict, expectCreated, expectNotFound, cargarStockPrincipal, getRolId } from './util';

const container = createContainer({ afipService: createMockAfipService(), comprobanteService: createMockComprobanteService() });
const app = createApp(container);

let token: string;
let otroToken: string;
let rolAutor: number;

const hoy = (): string => new Date().toISOString().slice(0, 10);
const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

let indicePersona = 9960;

const crearLibro = async (isbnLibro: string, precio = 1000) => {
    const res = await auth(
        request(app).post('/libro/').send({ isbn: isbnLibro, titulo: `Anticipo ${isbnLibro}`, fecha_edicion: '2020-01-01', precio })
    );
    expectCreated(res);
    return res.body.data;
};

const crearPersona = async (): Promise<number> => {
    indicePersona += 1;
    const res = await auth(
        request(app).post('/persona/').send({ nombre: `Persona anticipo ${indicePersona}`, dni: dni(indicePersona) })
    );
    expectCreated(res);
    return res.body.data.id;
};

const asignar = async (isbnLibro: string, idPersona: number, monto?: number) => {
    const body: Record<string, unknown> = { id_persona: idPersona, rol: rolAutor, porcentaje: 10 };
    if (monto !== undefined) body.monto_acordado = monto;

    return auth(request(app).post(`/libro/${isbnLibro}/personas`).send(body));
};

type Anticipo = {
    id: number;
    id_libro: number;
    isbn: string;
    titulo: string;
    id_persona: number;
    nombre: string;
    id_rol: number;
    rol: string;
    monto: number;
    fecha_lanzamiento: string;
    reimpresiones: number;
    pagado: boolean;
    fecha_pago: string | null;
};

const listarAnticipos = async (t = token): Promise<Anticipo[]> => (await auth(request(app).get('/anticipos/'), t)).body;

const anticipoDe = (anticipos: Anticipo[], isbnLibro: string) => anticipos.filter((a) => a.isbn === isbnLibro);

beforeAll(async () => {
    const [res, otroRes] = await Promise.all([
        request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED })
    ]);
    token = res.body.token;
    otroToken = otroRes.body.token;
    rolAutor = await getRolId(app, token, 'autor');
});

afterAll(() => {
    db.$client.end();
});

describe('GET /anticipos/: seed', () => {
    test('deja 4 anticipos por cuenta, uno de un libro con dos reimpresiones y un único anticipo', async () => {
        const anticipos = await listarAnticipos();

        expect(anticipos).toHaveLength(4);
        for (const anticipo of anticipos) {
            // Sin parciales ni saldo: pendiente o pagado, y con los datos del libro/persona/rol.
            expect(anticipo).toMatchObject({
                id: expect.any(Number),
                id_libro: expect.any(Number),
                isbn: expect.any(String),
                titulo: expect.any(String),
                id_persona: expect.any(Number),
                nombre: expect.any(String),
                id_rol: expect.any(Number),
                rol: expect.any(String),
                monto: expect.any(Number),
                fecha_lanzamiento: expect.any(String),
                reimpresiones: expect.any(Number),
                pagado: expect.any(Boolean)
            });
            expect(anticipo).not.toHaveProperty('saldo');
            expect(anticipo).not.toHaveProperty('parcial');
        }

        const reimpreso = anticipos.find((anticipo) => anticipo.reimpresiones === 2);
        expect(reimpreso).toBeDefined();
        // Un libro reimpreso sigue teniendo un solo anticipo.
        expect(anticipoDe(anticipos, reimpreso.isbn)).toHaveLength(1);
    });

    test('un usuario nunca ve los anticipos de otra cuenta', async () => {
        const propios = await listarAnticipos();
        const ajenos = await listarAnticipos(otroToken);

        const idsPropios = new Set(propios.map((a) => a.id));
        expect(ajenos.some((a) => idsPropios.has(a.id))).toBe(false);
    });
});

describe('Generación del anticipo al lanzar el libro', () => {
    let isbnLibro: string;
    let isbnSinMonto: string;
    let isbnTardio: string;
    let isbnSinLanzar: string;

    test('la primera incorporación de stock (exterior → principal) genera el anticipo con su monto y fecha', async () => {
        isbnLibro = isbn(9950);
        await crearLibro(isbnLibro);
        const personaId = await crearPersona();

        expectCreated(await asignar(isbnLibro, personaId, 30000));

        // Todavía no hay anticipo: sin incorporación de stock no se genera.
        expect(anticipoDe(await listarAnticipos(), isbnLibro)).toHaveLength(0);

        const movimiento = await cargarStockPrincipal(app, token, isbnLibro, 5);
        expect(movimiento.status).toBe(201);

        const anticipos = anticipoDe(await listarAnticipos(), isbnLibro);
        expect(anticipos).toHaveLength(1);
        expect(anticipos[0]).toMatchObject({ monto: 30000, fecha_lanzamiento: hoy(), reimpresiones: 0, pagado: false, id_persona: personaId });
    });

    test('una reimpresión posterior no crea otro anticipo ni lo modifica', async () => {
        const segundo = await cargarStockPrincipal(app, token, isbnLibro, 5);
        expect(segundo.status).toBe(201);

        const anticipos = anticipoDe(await listarAnticipos(), isbnLibro);
        expect(anticipos).toHaveLength(1);
        expect(anticipos[0]).toMatchObject({ monto: 30000, reimpresiones: 1 });
    });

    test('una relación sin monto acordado no genera anticipo', async () => {
        isbnSinMonto = isbn(9951);
        await crearLibro(isbnSinMonto);
        const personaId = await crearPersona();
        expectCreated(await asignar(isbnSinMonto, personaId));

        expect((await cargarStockPrincipal(app, token, isbnSinMonto, 5)).status).toBe(201);

        expect(anticipoDe(await listarAnticipos(), isbnSinMonto)).toHaveLength(0);
    });

    test('definir el monto acordado sobre un libro ya lanzado genera el anticipo una sola vez', async () => {
        isbnTardio = isbn(9952);
        await crearLibro(isbnTardio);
        const personaId = await crearPersona();
        expectCreated(await asignar(isbnTardio, personaId));

        expect((await cargarStockPrincipal(app, token, isbnTardio, 5)).status).toBe(201);
        expect(anticipoDe(await listarAnticipos(), isbnTardio)).toHaveLength(0);

        const conMonto = await auth(
            request(app).put(`/libro/${isbnTardio}/personas`).send({ id_persona: personaId, rol: rolAutor, porcentaje: 10, monto_acordado: 45000 })
        );
        expectCreated(conMonto);

        const generados = anticipoDe(await listarAnticipos(), isbnTardio);
        expect(generados).toHaveLength(1);
        expect(generados[0]).toMatchObject({ monto: 45000, fecha_lanzamiento: hoy() });

        // Editar el monto acordado de nuevo no crea otro anticipo ni pisa el snapshot.
        expectCreated(
            await auth(
                request(app).put(`/libro/${isbnTardio}/personas`).send({ id_persona: personaId, rol: rolAutor, porcentaje: 10, monto_acordado: 99999 })
            )
        );
        const despues = anticipoDe(await listarAnticipos(), isbnTardio);
        expect(despues).toHaveLength(1);
        expect(despues[0].monto).toBe(45000);
    });

    test('el alta del libro sin incorporación de stock no genera anticipo', async () => {
        isbnSinLanzar = isbn(9953);
        await crearLibro(isbnSinLanzar);
        const personaId = await crearPersona();
        expectCreated(await asignar(isbnSinLanzar, personaId, 12000));

        expect(anticipoDe(await listarAnticipos(), isbnSinLanzar)).toHaveLength(0);
    });

    test('POST /anticipos/:id/pagar paga el anticipo entero y rechaza repetir o ids ajenos', async () => {
        const propio = anticipoDe(await listarAnticipos(), isbnLibro)[0];
        expect(propio.pagado).toBe(false);

        const pago = await auth(request(app).post(`/anticipos/${propio.id}/pagar`));
        expect(pago.status).toBe(200);
        expect(pago.body.data).toMatchObject({ id: propio.id, pagado: true, fecha_pago: hoy() });

        // Un anticipo pagado sigue en el listado (histórico).
        const historico = (await listarAnticipos()).find((anticipo) => anticipo.id === propio.id);
        expect(historico).toMatchObject({ pagado: true, fecha_pago: hoy() });

        // Un anticipo ya pagado no se vuelve a pagar.
        expectConflict(await auth(request(app).post(`/anticipos/${propio.id}/pagar`)));

        // Id inexistente o de otra cuenta: 404.
        expectNotFound(await auth(request(app).post('/anticipos/999999999/pagar')));

        const ajeno = (await listarAnticipos(otroToken))[0];
        expectNotFound(await auth(request(app).post(`/anticipos/${ajeno.id}/pagar`)));

        // Fecha inválida: 400.
        expectBadRequest(await auth(request(app).post(`/anticipos/${propio.id}/pagar`).send({ fecha: '2026-13-01' })));
    });
});

describe('El anticipo está separado de las regalías', () => {
    test('pagar un anticipo no altera el total ni el saldo de una liquidación', async () => {
        const liquidaciones = (await auth(request(app).get('/liquidaciones/'))).body as { id: number }[];
        const fichaAntes = (await auth(request(app).get(`/liquidaciones/${liquidaciones[0].id}`))).body.data;

        const pendiente = (await listarAnticipos()).find((anticipo) => !anticipo.pagado)!;
        expect(pendiente).toBeDefined();
        expect((await auth(request(app).post(`/anticipos/${pendiente.id}/pagar`))).status).toBe(200);

        const fichaDespues = (await auth(request(app).get(`/liquidaciones/${liquidaciones[0].id}`))).body.data;
        expect(fichaDespues.total).toBe(fichaAntes.total);
        expect(fichaDespues.pagado).toBe(fichaAntes.pagado);
        expect(fichaDespues.saldo).toBe(fichaAntes.saldo);
        expect(fichaDespues.estado).toBe(fichaAntes.estado);
    });
});
