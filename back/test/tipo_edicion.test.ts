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
import { expectBadRequest, expectConflict, expectCreated, expectNotFound, getTipoEdicionId } from './util';

const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

// Los nombres llevan el sufijo `-tipo`: el archivo comparte la DB de test con
// otros que también crean tipos para el mismo usuario, y sin sufijo un nombre
// podría chocar entre archivos.
let token: string;
let otroToken: string;
let tipoAjeno: number;
let libro: { isbn: string };

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);
const crearTipo = (body: unknown, t = token) => auth(request(app).post('/tipo_edicion').send(body), t);
const listarTipos = async (t = token) => (await auth(request(app).get('/tipo_edicion'), t)).body as { id: number; nombre: string }[];

beforeAll(async () => {
    const [res, otroRes] = await Promise.all([
        request(app).post('/user/login').send({ identifier: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ identifier: 'editorial_norte', password: PASSWORD_SEED })
    ]);
    token = res.body.token;
    otroToken = otroRes.body.token;
    tipoAjeno = await getTipoEdicionId(app, otroToken, 'Normal');

    const libroRes = await auth(
        request(app).post('/libro/').send({ isbn: isbn(9901), titulo: 'Test tipos de edición', fecha_edicion: '2020-01-01', precio: 1000 })
    );
    expectCreated(libroRes);
    libro = { isbn: isbn(9901) };
});

afterAll(() => {
    db.$client.end();
});

describe('Tipos de edición por defecto de la cuenta', () => {
    test('una cuenta arranca con Normal, Pop up y Cartoné', async () => {
        const tipos = await listarTipos();

        expect(tipos.map((t) => t.nombre).sort()).toEqual(['Cartoné', 'Normal', 'Pop up']);
        for (const tipo of tipos) {
            expect(typeof tipo.id).toBe('number');
        }
    });

    test('los tipos de una cuenta nunca aparecen en otra', async () => {
        const propios = await listarTipos();
        const ajenos = await listarTipos(otroToken);

        const idsPropios = new Set(propios.map((t) => t.id));
        expect(ajenos.some((t) => idsPropios.has(t.id))).toBe(false);
    });
});

describe('GET /tipo_edicion/', () => {
    test('un tipo dado de baja no aparece en el listado', async () => {
        const creado = await crearTipo({ nombre: 'Baja listado-tipo' });
        expectCreated(creado);

        const id = creado.body.data.id;
        expect((await auth(request(app).delete(`/tipo_edicion/${id}`))).status).toBe(200);
        expect((await listarTipos()).some((t) => t.id === id)).toBe(false);
    });
});

describe('POST /tipo_edicion/', () => {
    test('crea un tipo con nombre válido (201) y queda disponible', async () => {
        const res = await crearTipo({ nombre: 'Tapa dura-tipo' });

        expectCreated(res);
        expect(res.body.data).toMatchObject({ nombre: 'Tapa dura-tipo' });
        expect(typeof res.body.data.id).toBe('number');

        expect((await listarTipos()).some((t) => t.id === res.body.data.id)).toBe(true);
    });

    test('sin nombre, vacío o sólo espacios: 400', async () => {
        expectBadRequest(await crearTipo({}));
        expectBadRequest(await crearTipo({ nombre: '' }));
        expectBadRequest(await crearTipo({ nombre: '   ' }));
    });

    test('nombre ya usado por un tipo activo: 409 (también sin distinguir mayúsculas)', async () => {
        expectCreated(await crearTipo({ nombre: 'Repetido-tipo' }));
        expectConflict(await crearTipo({ nombre: 'Repetido-tipo' }));
        expectConflict(await crearTipo({ nombre: 'REPETIDO-TIPO' }));
    });

    test('nombre igual al de un tipo dado de baja: 201', async () => {
        const creado = await crearTipo({ nombre: 'Reutilizable-tipo' });
        expectCreated(creado);
        expect((await auth(request(app).delete(`/tipo_edicion/${creado.body.data.id}`))).status).toBe(200);

        expectCreated(await crearTipo({ nombre: 'Reutilizable-tipo' }));
    });

    test('un usuario no puede crear tipos en la cuenta de otro', async () => {
        const creado = await crearTipo({ nombre: 'Solo cuenta A-tipo' });
        expectCreated(creado);

        expect((await listarTipos(otroToken)).some((t) => t.nombre === 'Solo cuenta A-tipo')).toBe(false);
        // El mismo nombre en la otra cuenta no choca: son catálogos distintos.
        expectCreated(await crearTipo({ nombre: 'Solo cuenta A-tipo' }, otroToken));
    });
});

describe('PUT /tipo_edicion/:id', () => {
    test('renombra un tipo activo (200)', async () => {
        const creado = await crearTipo({ nombre: 'Renombrable-tipo' });
        expectCreated(creado);

        const res = await auth(request(app).put(`/tipo_edicion/${creado.body.data.id}`).send({ nombre: 'Renombrado-tipo' }));

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: creado.body.data.id, nombre: 'Renombrado-tipo' });
    });

    test('el nombre nuevo aparece en los libros que usan el tipo', async () => {
        const creado = await crearTipo({ nombre: 'Rústica-tipo' });
        expectCreated(creado);
        const tipoId = creado.body.data.id;

        expect((await auth(request(app).put(`/libro/${libro.isbn}`).send({ tipo_edicion_id: tipoId }))).status).toBe(200);

        const tipoDelLibro = async () => (await auth(request(app).get(`/libro/${libro.isbn}`))).body.data.tipo_edicion;
        expect(await tipoDelLibro()).toBe('Rústica-tipo');

        expect((await auth(request(app).put(`/tipo_edicion/${tipoId}`).send({ nombre: 'Rústica cosida-tipo' }))).status).toBe(200);

        expect(await tipoDelLibro()).toBe('Rústica cosida-tipo');
    });

    test('nombre vacío: 400; nombre de otro activo: 409 (también sin distinguir mayúsculas)', async () => {
        const creado = await crearTipo({ nombre: 'Para editar-tipo' });
        expectCreated(creado);
        const id = creado.body.data.id;

        expectBadRequest(await auth(request(app).put(`/tipo_edicion/${id}`).send({ nombre: '   ' })));
        expectConflict(await auth(request(app).put(`/tipo_edicion/${id}`).send({ nombre: 'Repetido-tipo' })));
        expectConflict(await auth(request(app).put(`/tipo_edicion/${id}`).send({ nombre: 'repetido-tipo' })));
    });

    test('id inexistente, de otra cuenta o dado de baja: 404', async () => {
        expectNotFound(await auth(request(app).put('/tipo_edicion/999999999').send({ nombre: 'Nada' })));
        expectNotFound(await auth(request(app).put(`/tipo_edicion/${tipoAjeno}`).send({ nombre: 'Intruso' })));

        const creado = await crearTipo({ nombre: 'Editado dado de baja-tipo' });
        expectCreated(creado);
        await auth(request(app).delete(`/tipo_edicion/${creado.body.data.id}`));
        expectNotFound(await auth(request(app).put(`/tipo_edicion/${creado.body.data.id}`).send({ nombre: 'Tarde' })));
    });
});

describe('DELETE /tipo_edicion/:id (baja lógica)', () => {
    test('da de baja el tipo (200) y deja de ofrecerse al crear un libro', async () => {
        const creado = await crearTipo({ nombre: 'Descartable-tipo' });
        expectCreated(creado);
        const id = creado.body.data.id;

        expect((await auth(request(app).delete(`/tipo_edicion/${id}`))).status).toBe(200);
        expect((await listarTipos()).some((t) => t.id === id)).toBe(false);

        // Un tipo dado de baja se comporta como inexistente al asignarlo.
        expectNotFound(await auth(request(app).put(`/libro/${libro.isbn}`).send({ tipo_edicion_id: id })));
    });

    test('un libro que ya lo usaba sigue mostrando su nombre después de la baja', async () => {
        const creado = await crearTipo({ nombre: 'Histórico-tipo' });
        expectCreated(creado);
        const id = creado.body.data.id;

        expect((await auth(request(app).put(`/libro/${libro.isbn}`).send({ tipo_edicion_id: id }))).status).toBe(200);
        expect((await auth(request(app).delete(`/tipo_edicion/${id}`))).status).toBe(200);

        const res = await auth(request(app).get(`/libro/${libro.isbn}`));
        expect(res.body.data.tipo_edicion).toBe('Histórico-tipo');
    });

    test('id inexistente, de otra cuenta o ya dado de baja: 404', async () => {
        expectNotFound(await auth(request(app).delete('/tipo_edicion/999999999')));
        expectNotFound(await auth(request(app).delete(`/tipo_edicion/${tipoAjeno}`)));

        const creado = await crearTipo({ nombre: 'Baja doble-tipo' });
        expectCreated(creado);
        expect((await auth(request(app).delete(`/tipo_edicion/${creado.body.data.id}`))).status).toBe(200);
        expectNotFound(await auth(request(app).delete(`/tipo_edicion/${creado.body.data.id}`)));
    });
});

describe('Alta de libro y tipo de edición', () => {
    test('sin tipo en el alta, el libro queda con el Normal de la cuenta', async () => {
        const creado = await auth(
            request(app)
                .post('/libro/')
                .send({ isbn: isbn(9902), titulo: 'Libro sin tipo elegido', fecha_edicion: '2020-01-01', precio: 1000 })
        );
        expectCreated(creado);
        expect(creado.body.data.tipo_edicion).toBe('Normal');
    });

    test('un tipo de otra cuenta no se puede asignar: 404', async () => {
        expectNotFound(await auth(request(app).put(`/libro/${libro.isbn}`).send({ tipo_edicion_id: tipoAjeno })));
    });
});
