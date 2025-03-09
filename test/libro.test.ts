import {describe, expect, it} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

process.env.DB_NAME = "epublit_test";
import {app, server} from '../src/app';
import {conn} from '../src/db'
import {expectErrorResponse, expectDataResponse, expectBadRequest, expectCreated, expectNotFound} from './util';
import { RowDataPacket } from 'mysql2';

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
    const res = (await conn.query<RowDataPacket[]>(`
        SELECT isbn FROM libros
        WHERE isbn=${libro.isbn}
    `))[0];

    if (res.length){
        await conn.query(`
            DELETE FROM libros_personas
            WHERE isbn=${libro.isbn}
        `);

        await conn.query(`
            DELETE FROM precio_libros
            WHERE isbn=${libro.isbn}
        `);

        await conn.query(`
            DELETE FROM libros
            WHERE isbn=${libro.isbn}
        `);
    }else{
        console.log("El libro no estaba cargado");
    }
    await conn.query(`
        DELETE FROM personas
        WHERE dni=39019203
    `);
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
    it('Crear libro sin personas', async () => {
        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expectBadRequest(res);
    });
    
    it('Insertar Libro', async () => {
        const personas   = (await request(app)
            .get('/persona/')
            .set('Authorization', `Bearer ${token}`)
            ).body;

        //Autor que agarramos desde la tabla
        libro.autores = [{
            id_persona: personas.at(-1).id,
            porcentaje: 20,
        }];

        libro.ilustradores = [{
            nombre: "juancito",
            dni: "39019203",
            porcentaje: 25.0,
        }];

        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expectCreated(res);
        expect(res.body.data).toHaveProperty("ilustradores");
        expect(res.body.data).toHaveProperty("autores");        

        libro.personas = res.body.data.ilustradores.concat(res.body.data.autores);
    });

    it('Insertar la misma persona que antes', async () => {
        const personas = [libro.personas[0]];

        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send(personas);

        expectNotFound(res);
    });

    it('Agregar personas', async () => {
        //Get real persons from the table
        let personas   = (await request(app)
            .get('/persona/')
            .set('Authorization', `Bearer ${token}`)
            ).body;

        personas = [{
            id_persona: personas.at(0).id,
            porcentaje: 20.1,
            tipo: "autor"
        },
        {
            id_persona: personas.at(1).id,
            porcentaje: 25.5,
            tipo: "ilustrador"
        }]

        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send(personas);
        expectCreated(res);

        libro.personas = libro.personas.concat(personas);
    });

    it('El libro tiene las personas cargadas con todos los datos', async() => {
        const res = (await request(app)
            .get(`/libro/${libro.isbn}`)
            .set('Authorization', `Bearer ${token}`)
        );

        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty("autores");
        expect(res.body).toHaveProperty("ilustradores");

        const autores = libro.personas.filter((p: any) => p.tipo == "autor").map((p: any) => p.id_persona).sort();
        const ilustradores = libro.personas.filter((p: any) => p.tipo == "ilustrador").map((p: any) => p.id_persona).sort();

        expect(res.body.autores.map((p: any) => p.id_persona).sort()).toEqual(autores);
        expect(res.body.ilustradores.map((p: any) => p.id_persona).sort()).toEqual(ilustradores);
    });

    it('Las personas tienen el libro asignado', async () => {
        for (const persona of libro.personas){
            const res = (await request(app)
                .get('/persona/'+persona.id_persona)
                .set('Authorization', `Bearer ${token}`)
            );

            expect(res.status).toEqual(200);
            expect(res.body).toHaveProperty('libros');

            const libros = res.body.libros;

            //Revisar que los autores e ilustradores tengan ese libro asociado
            expect(libros.map((l: any) => l.isbn)).toContain(libro.isbn);
        }
    });
});

describe('Obtener libro GET /libro/:isbn', function () {
    it("Libro obtenido", function (done) {
        request(app)
        .get('/libro/'+libro.isbn)
        .set('Authorization', `Bearer ${token}`)
        .expect(200, done)
    });

    /*it("Listar libros con stock", async function () {
        const res = await request(app)
            .get('/libro?stock=true'+libro.isbn)
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toEqual(200);
        for (const l of res.body){
            expect(l.precio).toBeGreaterThan(-1)
        }
    });*/

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

    it('Actualizamos una persona', async () => {
        const data = [{
            id_persona: libro.personas[1].id_persona,
            tipo: libro.personas[1].tipo,
            porcentaje: 25
        },
        {
            id_persona: libro.personas[3].id_persona,
            tipo: libro.personas[3].tipo,
            porcentaje: 33.0
        }];

        const res = await request(app)
            .put('/libro/'+libro.isbn+'/personas')
            .set('Authorization', `Bearer ${token}`)
            .send(data);

        expectCreated(res);
    });

    it('Actualizamos una persona que no esta en el libro', async () => {
        const autor_copy = JSON.parse(JSON.stringify(libro.personas[0]));
        autor_copy.id_persona = -1;
        const res = await request(app)
            .put('/libro/'+libro.isbn+'/personas')
            .set('Authorization', `Bearer ${token}`)
            .send(autor_copy);

        expectNotFound(res);
    });
});

describe('DELETE /libro', function () {
    it('Borrar una persona del libro', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send([{
                id_persona: libro.personas[0].id_persona,
                tipo: libro.personas[0].tipo
            }]);

        expectDataResponse(res, 200);
    });

    it('Intentar Borrar una persona que no trabaja en el libro', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send([{
                id_persona: -1,
                tipo: "autor",
            }]);

        expectNotFound(res);
    });

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

    it('Las personas no tienen más el libro asignado', async () => {
        const autor       = (await request(app)
            .get('/persona/'+libro.personas[0].id_persona)
            .set('Authorization', `Bearer ${token}`)
            ).body;
        //console.log(autor);
        const ilustrador  = (await request(app)
            .get('/persona/'+libro.personas[1].id_persona)
            .set('Authorization', `Bearer ${token}`)
            ).body;
        //console.log(ilustrador);

        //Revisar que los autores e ilustradores NO tengan ese libro asociado
        expect(     autor.libros.map((l: any) => l.isbn)).not.toContain(libro.isbn);
        expect(ilustrador.libros.map((l: any) => l.isbn)).not.toContain(libro.isbn);
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
