import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

// DB de test: ver test/cliente.test.ts para la explicación completa del
// setup (reset-test-db.sh + DB_NAME por variable de entorno del shell).
import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectBadRequest, expectCreated, expectUpdated, expectNotFound, expectConflict, expectList } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { dni, email } from '../seeders/data';

// Recipe fija de `seeders/personas.seeder.ts`: 6 personas por usuario,
// dni(índice global). `libreria_sur` es el primer usuario seedeado, así
// que sus personas son dni(0)..dni(5).
const DNI_PERSONA_1 = dni(0);
const DNI_PERSONA_2 = dni(1);
const DNI_PERSONA_3 = dni(2);

let token: string;

async function getPersonaPorDni(targetDni: string) {
    const res = await request(app)
        .get('/persona?pageSize=100')
        .set('Authorization', `Bearer ${token}`);

    return res.body.items.find((p: { dni: string }) => p.dni === targetDni);
}

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

    token = res.body.token;
});

afterAll(() => {
    db.$client.end();
    server.close();
});

describe('GET /persona', () => {
    it('lista paginada', async () => {
        const res = await request(app)
            .get('/persona')
            .set('Authorization', `Bearer ${token}`);

        expectList(res);
        expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('filtra por tipo (autor/ilustrador)', async () => {
        const res = await request(app)
            .get('/persona?tipo=autor')
            .set('Authorization', `Bearer ${token}`);

        expectList(res);
        expect(res.body.items.length).toBeGreaterThan(0);
    });
});

describe('GET /persona/:id', () => {
    it('persona que no existe', async () => {
        const res = await request(app)
            .get('/persona/999999999')
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    it('devuelve la persona con sus libros', async () => {
        const persona = await getPersonaPorDni(DNI_PERSONA_1);

        const res = await request(app)
            .get(`/persona/${persona.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.data.dni).toEqual(DNI_PERSONA_1);
        expect(res.body.data.libros).toBeInstanceOf(Array);
    });
});

describe('POST /persona', () => {
    it('sin nombre', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send({ dni: '99999999' });

        expectBadRequest(res);
    });

    it('sin dni', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Sin dni' });

        expectBadRequest(res);
    });

    it('dni repetido con una persona propia existente', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Otra persona', dni: DNI_PERSONA_1 });

        expectConflict(res);
    });

    it('creación exitosa', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Persona de prueba POST', dni: dni(9999), email: email('test', 9999) });

        expectCreated(res);
        expect(res.body.data.dni).toEqual(dni(9999));
    });
});

describe('PUT /persona/:id', () => {
    it('dni repetido con otra persona propia', async () => {
        const persona = await getPersonaPorDni(DNI_PERSONA_2);

        const res = await request(app)
            .put(`/persona/${persona.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ dni: DNI_PERSONA_3 });

        expectConflict(res);
    });

    it('actualiza nombre sin tocar el dni', async () => {
        const persona = await getPersonaPorDni(DNI_PERSONA_2);

        const res = await request(app)
            .put(`/persona/${persona.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Nombre actualizado' });

        expectUpdated(res);
        expect(res.body.data.nombre).toEqual('Nombre actualizado');
        expect(res.body.data.dni).toEqual(DNI_PERSONA_2);
    });

    it('ignora un campo que no existe en el schema', async () => {
        const persona = await getPersonaPorDni(DNI_PERSONA_2);

        const res = await request(app)
            .put(`/persona/${persona.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ no_existe: 99, nombre: 'Otro nombre' });

        expectUpdated(res);
        expect(res.body.data.nombre).toEqual('Otro nombre');
    });
});

describe('DELETE /persona/:id', () => {
    it('persona que no existe', async () => {
        const res = await request(app)
            .delete('/persona/999999999')
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    it('elimina una persona propia y ya no aparece', async () => {
        // Crea su propia persona descartable en vez de tocar una seedeada:
        // el DELETE es lo que se está probando, no hace falta que sobreviva.
        const creada = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'A eliminar', dni: dni(9998) });
        expectCreated(creada);

        const res = await request(app)
            .delete(`/persona/${creada.body.data.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);

        const getRes = await request(app)
            .get(`/persona/${creada.body.data.id}`)
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(getRes);
    });
});
