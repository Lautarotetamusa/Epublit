import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectBadRequest, expectCreated, expectNotFound, expectUpdated } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';

const ORIGEN = 'https://tienda-libreria.test';

let token: string;
let otroToken: string;
let integracionId: number;
let apiKey: string;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

const crearIntegracion = (nombre: string, origen: string, t = token) =>
    auth(request(app).post('/integraciones').send({ nombre, origen }), t);

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });
    token = res.body.token;

    const otro = await request(app)
        .post('/user/login')
        .send({ username: 'editorial_norte', password: PASSWORD_SEED });
    otroToken = otro.body.token;
});

afterAll(() => {
    db.$client.end();
    server.close();
});

describe('POST /integraciones', () => {
    it.each([
        ['nombre vacío', { nombre: '   ', origen: ORIGEN }],
        ['origen vacío', { nombre: 'Tienda', origen: '' }],
        ['origen relativo', { nombre: 'Tienda', origen: '/tienda' }],
        ['origen con path', { nombre: 'Tienda', origen: `${ORIGEN}/checkout` }],
        ['origen con query', { nombre: 'Tienda', origen: `${ORIGEN}?a=1` }],
        ['origen con fragmento', { nombre: 'Tienda', origen: `${ORIGEN}#seccion` }],
        ['origen con credenciales', { nombre: 'Tienda', origen: 'https://user:pass@tienda.test' }],
        ['origen no http', { nombre: 'Tienda', origen: 'ftp://tienda.test' }]
    ])('rechaza %s', async (_caso, body) => {
        const res = await crearIntegracion(body.nombre, body.origen);
        expectBadRequest(res);
    });

    it('crea la integración y devuelve la clave completa una sola vez', async () => {
        const res = await crearIntegracion('Tienda web', ORIGEN);

        expectCreated(res);
        integracionId = res.body.data.integracion.id;
        apiKey = res.body.data.apiKey;

        expect(integracionId).toBeTypeOf('number');
        expect(apiKey).toMatch(/^epb_/);
        expect(res.body.data.integracion.prefijo).toBe(apiKey.slice(0, 8));
        expect(res.body.data.integracion.origen).toBe(ORIGEN);
        expect(res.body.data.integracion.activa).toBe(true);
        expect(res.body.data.integracion.revocada).toBe(false);
        expect(res.body.data.integracion.apiKey).toBeUndefined();
        expect(res.body.data.integracion.clave_hash).toBeUndefined();
    });
});

describe('GET /integraciones', () => {
    it('lista sin exponer la clave completa', async () => {
        const res = await auth(request(app).get('/integraciones'));

        expect(res.status).toBe(200);
        const integracion = res.body.data.integraciones.find((i: { id: number }) => i.id === integracionId);
        expect(integracion).toMatchObject({
            nombre: 'Tienda web',
            prefijo: apiKey.slice(0, 8),
            origen: ORIGEN,
            activa: true,
            revocada: false
        });
        expect(JSON.stringify(res.body)).not.toContain(apiKey);
    });

    it('una integración de otra cuenta devuelve 404 al operarla', async () => {
        const res = await auth(
            request(app).patch(`/integraciones/${integracionId}`).send({ activa: false }),
            otroToken
        );

        expect(res.status).toBe(404);
        expectNotFound(res);
    });
});

describe('API pública: autenticación y CORS', () => {
    it('sin API key devuelve 401 con el sobre público', async () => {
        const res = await request(app).get('/public/tienda/v1/config');

        expect(res.status).toBe(401);
        expect(res.body.error).toMatchObject({ codigo: 'no_autenticado' });
        expect(res.body.error.detalles).toBeInstanceOf(Array);
    });

    it('con una clave inexistente devuelve 401', async () => {
        const res = await request(app)
            .get('/public/tienda/v1/config')
            .set('X-API-Key', 'epb_inexistente');

        expect(res.status).toBe(401);
        expect(res.body.error.codigo).toBe('no_autenticado');
    });

    it('con un Origin distinto devuelve 403', async () => {
        const res = await request(app)
            .get('/public/tienda/v1/config')
            .set('X-API-Key', apiKey)
            .set('Origin', 'https://otro-origen.test');

        expect(res.status).toBe(403);
        expect(res.body.error.codigo).toBe('origen_no_permitido');
    });

    it('el origen permitido recibe CORS y actualiza el último uso', async () => {
        const res = await request(app)
            .get('/public/tienda/v1/config')
            .set('X-API-Key', apiKey)
            .set('Origin', ORIGEN);

        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe(ORIGEN);
        expect(res.body).toMatchObject({
            moneda: 'ARS',
            mercadopago: { disponible: false },
            envio: { disponible: false }
        });
        expect(JSON.stringify(res.body)).not.toMatch(/token|credential|password/i);

        const listado = await auth(request(app).get('/integraciones'));
        const integracion = listado.body.data.integraciones.find((i: { id: number }) => i.id === integracionId);
        expect(integracion.ultimoUso).not.toBeNull();
    });

    it('el preflight del origen permitido responde 204 con CORS', async () => {
        const res = await request(app)
            .options('/public/tienda/v1/config')
            .set('Origin', ORIGEN)
            .set('Access-Control-Request-Method', 'GET');

        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe(ORIGEN);
        expect(res.headers['access-control-allow-headers']).toContain('X-API-Key');
    });

    it('el preflight de un origen desconocido no recibe CORS', async () => {
        const res = await request(app)
            .options('/public/tienda/v1/config')
            .set('Origin', 'https://otro-origen.test')
            .set('Access-Control-Request-Method', 'GET');

        expect(res.status).toBe(403);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        expect(res.body.error.codigo).toBe('origen_no_permitido');
    });

    it('una integración inactiva no autentica', async () => {
        const patch = await auth(request(app).patch(`/integraciones/${integracionId}`).send({ activa: false }));
        expectUpdated(patch);
        expect(patch.body.data.activa).toBe(false);

        const res = await request(app)
            .get('/public/tienda/v1/config')
            .set('X-API-Key', apiKey)
            .set('Origin', ORIGEN);

        expect(res.status).toBe(403);
        expect(res.body.error.codigo).toBe('integracion_inactiva');
    });

    it('reactivar vuelve a habilitar la clave', async () => {
        const patch = await auth(request(app).patch(`/integraciones/${integracionId}`).send({ activa: true }));
        expectUpdated(patch);

        const res = await request(app)
            .get('/public/tienda/v1/config')
            .set('X-API-Key', apiKey)
            .set('Origin', ORIGEN);

        expect(res.status).toBe(200);
    });
});

describe('DELETE /integraciones', () => {
    it('revoca de forma irreversible', async () => {
        const res = await auth(request(app).delete(`/integraciones/${integracionId}`));

        expect(res.status).toBe(200);
        expect(res.body.data.revocada).toBe(true);
        expect(res.body.data.activa).toBe(false);

        const publica = await request(app)
            .get('/public/tienda/v1/config')
            .set('X-API-Key', apiKey)
            .set('Origin', ORIGEN);

        expect(publica.status).toBe(403);
        expect(publica.body.error.codigo).toBe('integracion_inactiva');

        const reactivar = await auth(request(app).patch(`/integraciones/${integracionId}`).send({ activa: true }));
        expect(reactivar.status).toBe(409);
        expect(reactivar.body.errors[0].code).toBe('Conflict');
    });
});
