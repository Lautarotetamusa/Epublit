import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { isbn, dni } from '../seeders/data';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectBadRequest, expectConflict, expectCreated, expectNotFound, getRolId } from './util';

const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

// Los nombres de rol llevan el sufijo `-rol`: el archivo comparte la DB de test
// con otros (que también crean roles para el mismo usuario) y sin sufijo un
// nombre podría chocar entre archivos.
let token: string;
let otroToken: string;
let rolAutorAjeno: number;
let libro: { isbn: string };
let persona: { id: number };
let personaDescartable: { id: number };

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);
const crearRol = (body: unknown, t = token) => auth(request(app).post('/rol').send(body), t);
const listarRoles = async (t = token) => (await auth(request(app).get('/rol'), t)).body as { id: number; nombre: string }[];
const asignarPersona = (idPersona: number, rolId: number, t = token) =>
    auth(request(app).post(`/libro/${libro.isbn}/personas`).send({ id_persona: idPersona, rol: rolId, porcentaje: 10 }), t);

beforeAll(async () => {
    const [res, otroRes] = await Promise.all([
        request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED })
    ]);
    token = res.body.token;
    otroToken = otroRes.body.token;
    rolAutorAjeno = await getRolId(app, otroToken, 'autor');

    const libroRes = await auth(
        request(app).post('/libro/').send({ isbn: isbn(9900), titulo: 'Test roles', fecha_edicion: '2020-01-01', precio: 1000 })
    );
    expectCreated(libroRes);
    libro = { isbn: isbn(9900) };

    const personaRes = await auth(request(app).post('/persona/').send({ nombre: 'Persona roles', dni: dni(9980) }));
    expectCreated(personaRes);
    persona = personaRes.body.data;

    const descartableRes = await auth(request(app).post('/persona/').send({ nombre: 'Persona descartable roles', dni: dni(9981) }));
    expectCreated(descartableRes);
    personaDescartable = descartableRes.body.data;
});

afterAll(() => {
    db.$client.end();
});

describe('Roles por defecto de la cuenta', () => {
    test('una cuenta arranca con exactamente los roles activos autor e ilustrador', async () => {
        const roles = await listarRoles();

        expect(roles.map((r) => r.nombre).sort()).toEqual(['autor', 'ilustrador']);
        for (const rol of roles) {
            expect(typeof rol.id).toBe('number');
        }
    });

    test('los roles de una cuenta nunca aparecen en otra', async () => {
        const propios = await listarRoles();
        const ajenos = await listarRoles(otroToken);

        const idsPropios = new Set(propios.map((r) => r.id));
        expect(ajenos.some((r) => idsPropios.has(r.id))).toBe(false);
    });
});

describe('GET /rol/', () => {
    test('un rol dado de baja no aparece en el listado', async () => {
        const creado = await crearRol({ nombre: 'baja-listado-rol' });
        expectCreated(creado);

        const id = creado.body.data.id;
        expect((await auth(request(app).delete(`/rol/${id}`))).status).toBe(200);
        expect((await listarRoles()).some((r) => r.id === id)).toBe(false);
    });
});

describe('POST /rol/', () => {
    test('crea un rol con nombre válido (201) y queda disponible', async () => {
        const res = await crearRol({ nombre: 'Corrector-rol' });

        expectCreated(res);
        expect(res.body.data).toMatchObject({ nombre: 'Corrector-rol' });
        expect(typeof res.body.data.id).toBe('number');

        expect((await listarRoles()).some((r) => r.id === res.body.data.id)).toBe(true);
    });

    test('sin nombre, vacío o sólo espacios: 400', async () => {
        expectBadRequest(await crearRol({}));
        expectBadRequest(await crearRol({ nombre: '' }));
        expectBadRequest(await crearRol({ nombre: '   ' }));
    });

    test('nombre ya usado por un rol activo: 409 (también sin distinguir mayúsculas)', async () => {
        expectCreated(await crearRol({ nombre: 'Repetido-rol' }));
        expectConflict(await crearRol({ nombre: 'Repetido-rol' }));
        expectConflict(await crearRol({ nombre: 'REPETIDO-ROL' }));
    });

    test('nombre igual al de un rol dado de baja: 201', async () => {
        const creado = await crearRol({ nombre: 'Reutilizable-rol' });
        expectCreated(creado);
        expect((await auth(request(app).delete(`/rol/${creado.body.data.id}`))).status).toBe(200);

        expectCreated(await crearRol({ nombre: 'Reutilizable-rol' }));
    });

    test('un usuario no puede crear roles en la cuenta de otro', async () => {
        const creado = await crearRol({ nombre: 'Solo cuenta A-rol' });
        expectCreated(creado);

        expect((await listarRoles(otroToken)).some((r) => r.nombre === 'Solo cuenta A-rol')).toBe(false);
        // El mismo nombre en la otra cuenta no choca: son catálogos distintos.
        expectCreated(await crearRol({ nombre: 'Solo cuenta A-rol' }, otroToken));
    });
});

describe('PUT /rol/:id', () => {
    test('renombra un rol activo (200)', async () => {
        const creado = await crearRol({ nombre: 'Renombrable-rol' });
        expectCreated(creado);

        const res = await auth(request(app).put(`/rol/${creado.body.data.id}`).send({ nombre: 'Renombrado-rol' }));

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ id: creado.body.data.id, nombre: 'Renombrado-rol' });
    });

    test('el nombre nuevo aparece en el detalle del libro sin reasignar la relación', async () => {
        const creado = await crearRol({ nombre: 'Traductor-rol' });
        expectCreated(creado);
        const rolId = creado.body.data.id;

        expect((await asignarPersona(persona.id, rolId)).status).toBe(201);

        const personasDeLibro = async () => {
            const res = await auth(request(app).get(`/libro/${libro.isbn}`));
            return res.body.data.personas as { id_persona: number; rol: { id: number; nombre: string } }[];
        };
        const librosDePersona = async () => {
            const res = await auth(request(app).get(`/persona/${persona.id}`));
            return res.body.data.libros as { isbn: string; rol: { id: number; nombre: string } }[];
        };

        expect((await personasDeLibro()).find((p) => p.rol.id === rolId)?.rol.nombre).toBe('Traductor-rol');
        expect((await librosDePersona()).find((l) => l.isbn === libro.isbn)?.rol.nombre).toBe('Traductor-rol');

        const renombre = await auth(request(app).put(`/rol/${rolId}`).send({ nombre: 'Traductora-rol' }));
        expect(renombre.status).toBe(200);

        // Mismo nombre nuevo en el detalle del libro y en la ficha de la
        // persona, sin reasignar la relación.
        expect((await personasDeLibro()).find((p) => p.rol.id === rolId)?.rol.nombre).toBe('Traductora-rol');
        expect((await librosDePersona()).find((l) => l.isbn === libro.isbn)?.rol.nombre).toBe('Traductora-rol');
    });

    test('nombre vacío: 400; nombre de otro activo: 409 (también sin distinguir mayúsculas)', async () => {
        const creado = await crearRol({ nombre: 'Para editar-rol' });
        expectCreated(creado);
        const id = creado.body.data.id;

        expectBadRequest(await auth(request(app).put(`/rol/${id}`).send({ nombre: '   ' })));
        expectConflict(await auth(request(app).put(`/rol/${id}`).send({ nombre: 'Repetido-rol' })));
        expectConflict(await auth(request(app).put(`/rol/${id}`).send({ nombre: 'repetido-rol' })));
    });

    test('id inexistente, de otra cuenta o dado de baja: 404', async () => {
        expectNotFound(await auth(request(app).put('/rol/999999999').send({ nombre: 'Nada' })));
        expectNotFound(await auth(request(app).put(`/rol/${rolAutorAjeno}`).send({ nombre: 'Intruso' })));

        const creado = await crearRol({ nombre: 'Editado dado de baja-rol' });
        expectCreated(creado);
        await auth(request(app).delete(`/rol/${creado.body.data.id}`));
        expectNotFound(await auth(request(app).put(`/rol/${creado.body.data.id}`).send({ nombre: 'Tarde' })));
    });
});

describe('DELETE /rol/:id (baja lógica)', () => {
    test('da de baja el rol (200), no se lista y no se puede asignar', async () => {
        const creado = await crearRol({ nombre: 'Descartable-rol' });
        expectCreated(creado);
        const id = creado.body.data.id;

        expect((await auth(request(app).delete(`/rol/${id}`))).status).toBe(200);
        expect((await listarRoles()).some((r) => r.id === id)).toBe(false);

        // Un rol dado de baja se comporta como inexistente al asignar personas.
        expectNotFound(await asignarPersona(persona.id, id));
    });

    test('en uso por un libro activo con una persona activa: 409 y no lo da de baja', async () => {
        const creado = await crearRol({ nombre: 'En uso-rol' });
        expectCreated(creado);
        const id = creado.body.data.id;

        expect((await asignarPersona(persona.id, id)).status).toBe(201);

        expectConflict(await auth(request(app).delete(`/rol/${id}`)));
        expect((await listarRoles()).some((r) => r.id === id)).toBe(true);
    });

    test('sólo lo referencia una persona dada de baja: 200 y lo da de baja', async () => {
        const creado = await crearRol({ nombre: 'Sin uso activo-rol' });
        expectCreated(creado);
        const id = creado.body.data.id;

        expect((await asignarPersona(personaDescartable.id, id)).status).toBe(201);
        expect((await auth(request(app).delete(`/persona/${personaDescartable.id}`))).status).toBe(200);

        expect((await auth(request(app).delete(`/rol/${id}`))).status).toBe(200);
    });

    test('id inexistente, de otra cuenta o ya dado de baja: 404', async () => {
        expectNotFound(await auth(request(app).delete('/rol/999999999')));
        expectNotFound(await auth(request(app).delete(`/rol/${rolAutorAjeno}`)));

        const creado = await crearRol({ nombre: 'Baja doble-rol' });
        expectCreated(creado);
        expect((await auth(request(app).delete(`/rol/${creado.body.data.id}`))).status).toBe(200);
        expectNotFound(await auth(request(app).delete(`/rol/${creado.body.data.id}`)));
    });
});
