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
import {expectCreated, expectNotFound, expectBadRequest, expectDataResponse} from './util';

let token: string;
const libro: any = {
    "isbn": "222222222",
    "titulo": "Test libro_persona",
    "fecha_edicion": "2020-02-17",
    "precio": 10000,
    "stock": 0
}
const personaAutor: any = { nombre: "Autor Test", email: "autor@test.com", dni: "33033033" };
const personaIlustrador: any = { nombre: "Ilustrador Test", email: "ilustrador@test.com", dni: "33033034" };
const personaAjena: any = { nombre: "Ajena Test", email: "ajena@test.com", dni: "33033035" };

afterAll(() => {
    conn.end();
    server.close();
});

it('HARD DELETE', async () => {
    await db.delete(librosPersonasTable).where(eq(librosPersonasTable.isbn, libro.isbn));
    await db.delete(precioLibrosTable).where(eq(precioLibrosTable.isbn, libro.isbn));
    await db.delete(librosTable).where(eq(librosTable.isbn, libro.isbn));
    await db.delete(personasTable).where(eq(personasTable.dni, personaAutor.dni));
    await db.delete(personasTable).where(eq(personasTable.dni, personaIlustrador.dni));
    await db.delete(personasTable).where(eq(personasTable.dni, personaAjena.dni));
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

describe('Setup: libro y personas propias', function () {
    it('Crear libro', async () => {
        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expectCreated(res);
        libro.id_libro = res.body.data.id_libro;
    });

    it('Crear persona autor', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(personaAutor);

        expectCreated(res);
        personaAutor.id = res.body.data.id;
    });

    it('Crear persona ilustrador', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(personaIlustrador);

        expectCreated(res);
        personaIlustrador.id = res.body.data.id;
    });

    it('Crear persona ajena (no se asocia a ningún libro)', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(personaAjena);

        expectCreated(res);
        personaAjena.id = res.body.data.id;
    });
});

describe('POST /libro/:isbn/personas', function () {
    it('Isbn ajeno/inexistente', async () => {
        const res = await request(app)
            .post(`/libro/${libro.isbn}999/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAutor.id, tipo: "autor", porcentaje: 100 });

        expectNotFound(res);
    });

    it('Persona inexistente', async () => {
        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAutor.id + 100000, tipo: "autor", porcentaje: 100 });

        expectNotFound(res);
    });

    it('Porcentaje fuera de rango', async () => {
        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAutor.id, tipo: "autor", porcentaje: 150 });

        expectBadRequest(res);
    });

    it('Alta simple (objeto único)', async () => {
        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAutor.id, tipo: "autor", porcentaje: 50 });

        expectCreated(res);
        expect(res.body.data.personas).toHaveLength(1);
    });

    it('Duplicado: misma persona ya asociada (otro tipo)', async () => {
        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send([
                { id_persona: personaAutor.id, tipo: "ilustrador", porcentaje: 10 },
                { id_persona: personaIlustrador.id, tipo: "ilustrador", porcentaje: 10 }
            ]);

        expectNotFound(res); // Duplicated tiene status 404, ver src/models/errors.ts

        // No se creó ninguna fila del lote (todo o nada), ni la de personaIlustrador.
        const getRes = await request(app)
            .get(`/libro/${libro.isbn}`)
            .set('Authorization', `Bearer ${token}`);
        expect(getRes.body.ilustradores).toEqual([]);
    });

    it('Alta en lote (personaIlustrador aún no asociada)', async () => {
        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send([{ id_persona: personaIlustrador.id, tipo: "ilustrador", porcentaje: 20 }]);

        expectCreated(res);
        expect(res.body.data.personas).toHaveLength(1);
    });
});

describe('PUT /libro/:isbn/personas', function () {
    it('Edición simple de porcentaje', async () => {
        const res = await request(app)
            .put(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAutor.id, tipo: "autor", porcentaje: 70 });

        expectDataResponse(res, 201);
        expect(res.body.data.personas[0].porcentaje).toBe(70);
    });

    it('Edición con porcentaje 0 (corrección del bug MySQL)', async () => {
        const res = await request(app)
            .put(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAutor.id, tipo: "autor", porcentaje: 0 });

        expectDataResponse(res, 201);
        expect(res.body.data.personas[0].porcentaje).toBe(0);

        const getRes = await request(app)
            .get(`/libro/${libro.isbn}`)
            .set('Authorization', `Bearer ${token}`);
        const autor = getRes.body.autores.find((a: any) => a.id_persona === personaAutor.id);
        expect(autor.porcentaje).toBe(0);
    });

    it('Combinación (id_persona, tipo) no asociada: todo o nada', async () => {
        const res = await request(app)
            .put(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send([
                { id_persona: personaIlustrador.id, tipo: "ilustrador", porcentaje: 99 },
                { id_persona: personaAutor.id, tipo: "ilustrador", porcentaje: 99 } // no asociada con este tipo
            ]);

        expectNotFound(res);

        // No se aplicó la actualización válida del lote.
        const getRes = await request(app)
            .get(`/libro/${libro.isbn}`)
            .set('Authorization', `Bearer ${token}`);
        const ilustrador = getRes.body.ilustradores.find((p: any) => p.id_persona === personaIlustrador.id);
        expect(ilustrador.porcentaje).not.toBe(99);
    });
});

describe('DELETE /libro/:isbn/personas', function () {
    it('Baja de una asociación inexistente no falla', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAjena.id, tipo: "autor" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('Baja simple', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAutor.id, tipo: "autor" });

        expect(res.status).toBe(200);

        const getRes = await request(app)
            .get(`/libro/${libro.isbn}`)
            .set('Authorization', `Bearer ${token}`);
        expect(getRes.body.autores.map((a: any) => a.id_persona)).not.toContain(personaAutor.id);
    });

    it('Baja en lote', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send([{ id_persona: personaIlustrador.id, tipo: "ilustrador" }]);

        expect(res.status).toBe(200);

        const getRes = await request(app)
            .get(`/libro/${libro.isbn}`)
            .set('Authorization', `Bearer ${token}`);
        expect(getRes.body.ilustradores).toEqual([]);
    });

    it('GET /persona/:id refleja las altas/bajas hechas en este archivo', async () => {
        const res = await request(app)
            .get(`/persona/${personaIlustrador.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        // personaIlustrador fue dada de baja del libro al final de este archivo.
        expect(res.body.libros.map((l: any) => l.isbn)).not.toContain(libro.isbn);
    });
});

describe('Libro eliminado: personas responde 404', function () {
    it('Eliminar el libro', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    it('POST /libro/:isbn/personas responde 404', async () => {
        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAjena.id, tipo: "autor", porcentaje: 10 });

        expectNotFound(res);
    });

    it('PUT /libro/:isbn/personas responde 404', async () => {
        const res = await request(app)
            .put(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAjena.id, tipo: "autor", porcentaje: 10 });

        expectNotFound(res);
    });

    it('DELETE /libro/:isbn/personas responde 404', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send({ id_persona: personaAjena.id, tipo: "autor" });

        expectNotFound(res);
    });
});
