import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectBadRequest, expectCreated, expectUpdated, expectNotFound, expectList } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';

// Recipe fija de `seeders/libros.seeder.ts`: 12 libros por usuario,
// isbn(índice global). `libreria_sur` es el primer usuario seedeado, así
// que sus libros son isbn(0)..isbn(11).
const ISBN_LIBRO_1 = isbn(0);

let token: string;

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

describe('GET /libro', () => {
    it('lista paginada', async () => {
        const res = await request(app)
            .get('/libro')
            .set('Authorization', `Bearer ${token}`);

        expectList(res);
        expect(res.body.items.length).toBeGreaterThan(0);
    });
});

describe('GET /libro/:isbn', () => {
    it('libro que no existe', async () => {
        const res = await request(app)
            .get(`/libro/${ISBN_LIBRO_1}999`)
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    it('devuelve el libro con autores/ilustradores', async () => {
        const res = await request(app)
            .get(`/libro/${ISBN_LIBRO_1}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.data.isbn).toEqual(ISBN_LIBRO_1);
        expect(res.body.data.autores).toBeInstanceOf(Array);
        expect(res.body.data.ilustradores).toBeInstanceOf(Array);
    });
});

describe('POST /libro', () => {
    it('sin isbn', async () => {
        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send({ titulo: 'Sin isbn' });

        expectBadRequest(res);
    });

    it('creación exitosa', async () => {
        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send({
                isbn: isbn(9999),
                titulo: 'Libro de prueba POST',
                fecha_edicion: '2020-02-17',
                precio: 10000,
                stock: 0
            });

        expectCreated(res);
        expect(res.body.data.isbn).toEqual(isbn(9999));
    });
});

describe('PUT /libro/:isbn', () => {
    it('actualiza el precio', async () => {
        const res = await request(app)
            .put(`/libro/${isbn(9999)}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ precio: 11100 });

        expectUpdated(res);
        expect(res.body.data.precio).toEqual(11100);
    });

    it('libro que no existe', async () => {
        const res = await request(app)
            .put(`/libro/${ISBN_LIBRO_1}999`)
            .set('Authorization', `Bearer ${token}`)
            .send({ precio: 1 });

        expectNotFound(res);
    });
});

describe('DELETE /libro/:isbn', () => {
    it('elimina el libro creado por este archivo', async () => {
        const res = await request(app)
            .delete(`/libro/${isbn(9999)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('ya no se puede obtener', async () => {
        const res = await request(app)
            .get(`/libro/${isbn(9999)}`)
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });
});
