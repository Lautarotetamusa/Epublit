import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { isbn } from '../seeders/data';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import {
    expectBadRequest,
    expectConflict,
    expectCreated,
    expectNotFound,
    cargarStockPrincipal,
    getMedioPagoId
} from './util';

const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

let token: string;
let otroToken: string;
let efectivoId: number;
let clienteId: number;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

const crearLibroConStock = async (isbnLibro: string, precio = 1000) => {
    const res = await auth(
        request(app).post('/libro/').send({ isbn: isbnLibro, titulo: 'Test medio pago', fecha_edicion: '2020-01-01', precio })
    );
    expectCreated(res);

    const movimiento = await cargarStockPrincipal(app, token, isbnLibro, 50);
    expect(movimiento.status).toBe(201);
};

const crearMedio = (body: unknown, t = token) => auth(request(app).post('/medio_pago/').send(body));
const listarMedios = async (t = token, ruta = '/medio_pago/') =>
    (await auth(request(app).get(ruta), t)).body as { id: number; nombre: string; comision: number }[];

beforeAll(async () => {
    const [res, otroRes] = await Promise.all([
        request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED })
    ]);
    token = res.body.token;
    otroToken = otroRes.body.token;
    efectivoId = await getMedioPagoId(app, token, 'efectivo');

    const cliente = await auth(request(app).get('/cliente?tipo=particular'));
    clienteId = cliente.body.items[0].id;

    await crearLibroConStock(isbn(9700));
    await crearLibroConStock(isbn(9671));
});

afterAll(() => {
    db.$client.end();
});

describe('Medios de pago por defecto', () => {
    test('una cuenta tiene exactamente los 5 medios por defecto, todos con comisión 0', async () => {
        const medios = await listarMedios();

        expect(medios.map((m) => m.nombre).sort()).toEqual(['credito', 'debito', 'efectivo', 'mercadopago', 'transferencia']);
        for (const medio of medios) {
            expect(medio).toMatchObject({ comision: 0 });
            expect(typeof medio.id).toBe('number');
        }
    });

    test('los medios de una cuenta nunca aparecen en otra cuenta', async () => {
        const propios = await listarMedios();
        const ajenos = await listarMedios(otroToken);

        const idsPropios = new Set(propios.map((m) => m.id));
        expect(ajenos.some((m) => idsPropios.has(m.id))).toBe(false);
    });
});

describe('GET /medio_pago/ y GET /venta/medios_pago', () => {
    test('devuelven el mismo listado de medios activos de la cuenta', async () => {
        const desdeMedioPago = await listarMedios();
        const desdeVenta = await listarMedios(token, '/venta/medios_pago');

        expect(desdeVenta).toEqual(desdeMedioPago);
    });

    test('un medio dado de baja no aparece en ninguno de los dos listados', async () => {
        const creado = await crearMedio({ nombre: 'Baja listado', comision: 3 });
        expectCreated(creado);
        const id = creado.body.data.id;

        const baja = await auth(request(app).delete(`/medio_pago/${id}`));
        expect(baja.status).toBe(200);

        expect((await listarMedios()).some((m) => m.id === id)).toBe(false);
        expect((await listarMedios(token, '/venta/medios_pago')).some((m) => m.id === id)).toBe(false);
    });
});

describe('POST /medio_pago/', () => {
    test('crea un medio con nombre y comisión válidos (201)', async () => {
        const res = await crearMedio({ nombre: 'Promo banco', comision: 12.5 });

        expectCreated(res);
        expect(res.body.data).toMatchObject({ nombre: 'Promo banco', comision: 12.5 });
        expect(res.body.data.id).toBeDefined();

        const listado = await listarMedios();
        expect(listado.some((m) => m.id === res.body.data.id)).toBe(true);
    });

    test('sin comisión la crea en 0', async () => {
        const res = await crearMedio({ nombre: 'Sin comision' });
        expectCreated(res);
        expect(res.body.data.comision).toBe(0);
    });

    test('sin nombre, vacío o sólo espacios: 400', async () => {
        expectBadRequest(await crearMedio({ comision: 1 }));
        expectBadRequest(await crearMedio({ nombre: '', comision: 1 }));
        expectBadRequest(await crearMedio({ nombre: '   ', comision: 1 }));
    });

    test('comisión fuera de [0, 100]: 400', async () => {
        expectBadRequest(await crearMedio({ nombre: 'Comision negativa', comision: -1 }));
        expectBadRequest(await crearMedio({ nombre: 'Comision alta', comision: 101 }));
    });

    test('nombre ya usado por un medio activo: 409', async () => {
        const res = await crearMedio({ nombre: 'Repetido activo' });
        expectCreated(res);
        expectConflict(await crearMedio({ nombre: 'Repetido activo' }));
    });

    test('nombre igual al de un medio dado de baja: 201', async () => {
        const creado = await crearMedio({ nombre: 'Reutilizable' });
        expectCreated(creado);
        expect((await auth(request(app).delete(`/medio_pago/${creado.body.data.id}`))).status).toBe(200);

        expectCreated(await crearMedio({ nombre: 'Reutilizable' }));
    });
});

describe('PUT /medio_pago/:id', () => {
    test('edita nombre y comisión (200)', async () => {
        const creado = await crearMedio({ nombre: 'Editable', comision: 1 });
        expectCreated(creado);

        const res = await auth(request(app).put(`/medio_pago/${creado.body.data.id}`).send({ nombre: 'Editado', comision: 5 }));
        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: creado.body.data.id, nombre: 'Editado', comision: 5 });
    });

    test('nombre vacío: 400; nombre de otro activo: 409', async () => {
        const creado = await crearMedio({ nombre: 'Para editar' });
        expectCreated(creado);

        expectBadRequest(await auth(request(app).put(`/medio_pago/${creado.body.data.id}`).send({ nombre: '   ' })));
        expectConflict(await auth(request(app).put(`/medio_pago/${creado.body.data.id}`).send({ nombre: 'efectivo' })));
    });

    test('comisión fuera de [0, 100]: 400', async () => {
        const creado = await crearMedio({ nombre: 'Comision editable' });
        expectCreated(creado);

        const id = creado.body.data.id;
        expectBadRequest(await auth(request(app).put(`/medio_pago/${id}`).send({ comision: -5 })));
        expectBadRequest(await auth(request(app).put(`/medio_pago/${id}`).send({ comision: 150 })));
    });

    test('id inexistente, de otra cuenta o dado de baja: 404', async () => {
        expectNotFound(await auth(request(app).put('/medio_pago/999999999').send({ nombre: 'Nada' })));

        const efectivoAjeno = await getMedioPagoId(app, otroToken, 'efectivo');
        expectNotFound(await auth(request(app).put(`/medio_pago/${efectivoAjeno}`).send({ nombre: 'Intruso' })));

        const creado = await crearMedio({ nombre: 'Editado dado de baja' });
        expectCreated(creado);
        await auth(request(app).delete(`/medio_pago/${creado.body.data.id}`));
        expectNotFound(await auth(request(app).put(`/medio_pago/${creado.body.data.id}`).send({ nombre: 'Tarde' })));
    });
});

describe('DELETE /medio_pago/:id (baja lógica)', () => {
    test('da de baja el medio y no se bloquea aunque esté usado por ventas', async () => {
        const medio = await crearMedio({ nombre: 'Usado en venta', comision: 0 });
        expectCreated(medio);
        const id = medio.body.data.id;

        const venta = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: id, tipo_cbte: 11, libros: [{ isbn: isbn(9700), cantidad: 1 }] })
        );
        expectCreated(venta);

        expect((await auth(request(app).delete(`/medio_pago/${id}`))).status).toBe(200);

        // La venta histórica sigue mostrando el nombre del medio.
        const ficha = await auth(request(app).get(`/venta/${venta.body.data.id}`));
        expect(ficha.status).toBe(200);
        expect(ficha.body.data.medio_pago).toMatchObject({ id, nombre: 'Usado en venta' });
    });

    test('id inexistente, de otra cuenta o ya dado de baja: 404', async () => {
        expectNotFound(await auth(request(app).delete('/medio_pago/999999999')));

        const efectivoAjeno = await getMedioPagoId(app, otroToken, 'efectivo');
        expectNotFound(await auth(request(app).delete(`/medio_pago/${efectivoAjeno}`)));

        const creado = await crearMedio({ nombre: 'Baja doble' });
        expectCreated(creado);
        expect((await auth(request(app).delete(`/medio_pago/${creado.body.data.id}`))).status).toBe(200);
        expectNotFound(await auth(request(app).delete(`/medio_pago/${creado.body.data.id}`)));
    });
});

describe('Venta con el medio de la cuenta', () => {
    test('guarda la comisión vigente y expone el medio como objeto con neto', async () => {
        const medio = await crearMedio({ nombre: 'Con comision 10', comision: 10 });
        expectCreated(medio);
        const id = medio.body.data.id;

        const res = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: id, tipo_cbte: 11, libros: [{ isbn: isbn(9700), cantidad: 2 }] })
        );
        expectCreated(res);
        // 1000 x 2 = 2000; neto = 2000 - 10% = 1800.
        expect(res.body.data).toMatchObject({
            total: 2000,
            neto: 1800,
            medio_pago: { id, nombre: 'Con comision 10', comision: 10 }
        });
    });

    test('sin medio de pago: 400; inexistente, ajeno o dado de baja: 404', async () => {
        const payload = { cliente: clienteId, tipo_cbte: 11, libros: [{ isbn: isbn(9700), cantidad: 1 }] };
        expectBadRequest(await auth(request(app).post('/venta/').send(payload)));

        expectNotFound(await auth(request(app).post('/venta/').send({ ...payload, medio_pago: 999999999 })));

        const efectivoAjeno = await getMedioPagoId(app, otroToken, 'efectivo');
        expectNotFound(await auth(request(app).post('/venta/').send({ ...payload, medio_pago: efectivoAjeno })));

        const medio = await crearMedio({ nombre: 'Dado de baja venta' });
        expectCreated(medio);
        await auth(request(app).delete(`/medio_pago/${medio.body.data.id}`));
        expectNotFound(await auth(request(app).post('/venta/').send({ ...payload, medio_pago: medio.body.data.id })));
    });

    test('una venta con un medio por defecto funciona igual', async () => {
        const res = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: efectivoId, tipo_cbte: 11, libros: [{ isbn: isbn(9671), cantidad: 1 }] })
        );

        expectCreated(res);
        expect(res.body.data).toMatchObject({ medio_pago: { id: efectivoId, nombre: 'efectivo', comision: 0 }, neto: 1000 });
        expect(res.body.data.comprobante).toMatchObject({ clase: 'factura' });
    });
});

describe('El neto se deriva de la comisión guardada', () => {
    test('cambiar la comisión del medio no altera el neto de las ventas ya hechas', async () => {
        const medio = await crearMedio({ nombre: 'Neto fijo', comision: 20 });
        expectCreated(medio);
        const id = medio.body.data.id;

        const venta = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: id, tipo_cbte: 11, libros: [{ isbn: isbn(9700), cantidad: 1 }] })
        );
        expectCreated(venta);
        expect(venta.body.data.neto).toBe(800); // 1000 - 20%

        await auth(request(app).put(`/medio_pago/${id}`).send({ comision: 50 }));

        const ficha = await auth(request(app).get(`/venta/${venta.body.data.id}`));
        expect(ficha.body.data.neto).toBe(800);
        expect(ficha.body.data.medio_pago.comision).toBe(20);
    });

    test('el neto no se persiste como columna de la venta', async () => {
        const venta = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: efectivoId, tipo_cbte: 11, libros: [{ isbn: isbn(9671), cantidad: 1 }] })
        );
        expectCreated(venta);

        const row = await container.transaccion.ventaRepository.getById(venta.body.data.id, 1);
        expect(row).not.toHaveProperty('neto');
    });
});

describe('Listado, ficha y detalle de movimiento', () => {
    test('el listado expone el nombre del medio y el neto', async () => {
        const res = await auth(request(app).get('/venta?pageSize=100'));

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        for (const venta of res.body.data) {
            expect(venta.medio_pago).toMatchObject({ id: expect.any(Number), nombre: expect.any(String), comision: expect.any(Number) });
            expect(venta.neto).toBeCloseTo(venta.total - (venta.medio_pago.comision / 100) * venta.total, 2);
        }
    });

    test('GET /venta?medioPago=<id> filtra por el medio de la cuenta, incluso dado de baja', async () => {
        const medio = await crearMedio({ nombre: 'Filtro medio', comision: 0 });
        expectCreated(medio);
        const id = medio.body.data.id;

        const venta = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: id, tipo_cbte: 11, libros: [{ isbn: isbn(9700), cantidad: 3 }] })
        );
        expectCreated(venta);

        const filtrado = await auth(request(app).get(`/venta?medioPago=${id}`));
        expect(filtrado.status).toBe(200);
        expect(filtrado.body.data.map((v: { id: number }) => v.id)).toContain(venta.body.data.id);

        // Sigue encontrándola después de dar de baja el medio (historial).
        await auth(request(app).delete(`/medio_pago/${id}`));
        const filtradoBaja = await auth(request(app).get(`/venta?medioPago=${id}`));
        expect(filtradoBaja.body.data.map((v: { id: number }) => v.id)).toContain(venta.body.data.id);
    });

    test('GET /venta?medioPago con un medio que no es de la cuenta: 400', async () => {
        const efectivoAjeno = await getMedioPagoId(app, otroToken, 'efectivo');
        expectBadRequest(await auth(request(app).get(`/venta?medioPago=${efectivoAjeno}`)));
        expectBadRequest(await auth(request(app).get('/venta?medioPago=999999999')));
    });

    test('el detalle de un movimiento con venta expone el medio (nombre) y el neto', async () => {
        const medio = await crearMedio({ nombre: 'Detalle movimiento', comision: 10 });
        expectCreated(medio);

        const venta = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: medio.body.data.id, tipo_cbte: 11, libros: [{ isbn: isbn(9671), cantidad: 1 }] })
        );
        expectCreated(venta);

        const detalle = await auth(request(app).get(`/movimiento/${venta.body.data.id}`));
        expect(detalle.status).toBe(200);
        expect(detalle.body.data.venta).toMatchObject({
            medio_pago: { nombre: 'Detalle movimiento', comision: 10 },
            neto: 900
        });
    });

    test('la ficha de una venta histórica cuyo medio fue dado de baja sigue mostrando el nombre', async () => {
        const medio = await crearMedio({ nombre: 'Historico baja', comision: 0 });
        expectCreated(medio);
        const id = medio.body.data.id;

        const venta = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: id, tipo_cbte: 11, libros: [{ isbn: isbn(9700), cantidad: 1 }] })
        );
        expectCreated(venta);
        await auth(request(app).delete(`/medio_pago/${id}`));

        const ficha = await auth(request(app).get(`/venta/${venta.body.data.id}`));
        expect(ficha.status).toBe(200);
        expect(ficha.body.data.medio_pago.nombre).toBe('Historico baja');

        const detalle = await auth(request(app).get(`/movimiento/${venta.body.data.id}`));
        expect(detalle.body.data.venta.medio_pago.nombre).toBe('Historico baja');
    });
});

describe('Comprobante', () => {
    test('el comprobante emitido guarda el nombre del medio como condición de venta', async () => {
        const res = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteId, medio_pago: efectivoId, tipo_cbte: 11, libros: [{ isbn: isbn(9671), cantidad: 1 }] })
        );
        expectCreated(res);

        const comprobante = await auth(
            request(app).get(`/comprobantes/${res.body.data.comprobante.id}`)
        );
        expect(comprobante.status).toBe(200);
        expect(comprobante.body.data.receptor.condicionVenta).toBe('efectivo');
    });
});
