import {describe, expect, it} from 'vitest';
import request from "supertest";
import { eq } from 'drizzle-orm';

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

process.env.DB_NAME = "epublit_test";
import {app, server} from '../src/app';
import {conn} from '../src/db'
import { db } from '../src/pgDb';
import { librosTable } from '../src/schemas/libros.schema';
import { precioLibrosTable } from '../src/schemas/precioLibros.schema';
import { librosPersonasTable } from '../src/schemas/librosPersonas.schema';
import { personasTable } from '../src/schemas/personas.schema';
import {expectCreated, expectNotFound} from './util';

let token: string;
const libro: any = {
    "isbn": "111111111",
    "titulo": "Test",
    "fecha_edicion": "2020-02-17",
    "precio": 10000,
    "stock": 0
}

afterAll(() => {
    conn.end();
    server.close();
});

it('HARD DELETE', async () => {
    await db.delete(librosPersonasTable).where(eq(librosPersonasTable.isbn, libro.isbn));
    await db.delete(precioLibrosTable).where(eq(precioLibrosTable.isbn, libro.isbn));
    await db.delete(librosTable).where(eq(librosTable.isbn, libro.isbn));
    await db.delete(personasTable).where(eq(personasTable.dni, '39019203'));
});

it('login', async () => {
    const data = {
        username: 'teti',
        password: 'Lautaro123.'
    }
    const res = await request(app)
        .post('/user/login')
        .send(data)

    expect(res.status).toBe(200);
    token = res.body.token;
});

describe('Crear libro POST /libro', function () {
    it('Insertar Libro', async () => {
        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expectCreated(res);
        expect(res.body.data).toHaveProperty("id_libro");
        expect(res.body.data.id_libro).toBeDefined();

        libro.id_libro = res.body.data.id_libro;
    });
});

describe('Obtener libro GET /libro/:isbn', function () {
    it("Libro obtenido", async () => {
        const res = await request(app)
            .get('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.autores).toEqual([]);
        expect(res.body.ilustradores).toEqual([]);
    });

    it("Intentar obtener libro que no existe", function (done) {
        request(app)
        .get('/libro/'+libro.isbn+19999)
        .set('Authorization', `Bearer ${token}`)
        .expect(404, done)
    });
});

describe('Actualizar libro PUT /libro/:isbn', function () {
    it('Todo es igual', async () => {
        const res = await request(app)
            .put('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expect(res.status).toEqual(201);
        expect(res.body.success).toEqual(true);
    });

    it('Actualizamos precio', async () => {
        libro.precio += 1100;
        const res = await request(app)
            .put('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expectCreated(res);
    });
});

describe('DELETE /libro', function () {
    it('Borrado', async () => {
        const res = await request(app)
            .delete('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message");
        expect(res.body).toHaveProperty("success");
        expect(res.body.success).toBe(true);
    });

    it('No se puede obtener el libro', async () => {
        const res = await request(app)
            .get('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(res);
    });

});

describe('Listar todos los libros GET /libro', function () {
    it("Lista obtenida", function (done) {
        request(app)
        .get('/libro')
        .set('Authorization', `Bearer ${token}`)
        .expect(200, done)
    });
});
