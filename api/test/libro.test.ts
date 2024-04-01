import {describe, expect, it} from '@jest/globals';
import request from "supertest";
import fs from 'fs';

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../../.env");
dotenv.config({path: path});

import {conn} from '../src/db'
import {expect_err_code, expect_success_code} from './util';
import { RowDataPacket } from 'mysql2';

const app = 'http://localhost:3001';

const rawdata = fs.readFileSync(join(__dirname, "libro.test.json"));
const tests = JSON.parse(String(rawdata));

let token: string;
let libro: any
libro = {
    "isbn": "111111111",
    "titulo": "Test",
    "fecha_edicion": "2020-02-17",
    "precio": 10000,
    "stock": 0
}

it('HARD DELETE', async () => {
    let res = (await conn.query<RowDataPacket[]>(`
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
    let data = {
        username: 'teti',
        password: 'Lautaro123.'
    }
    const res = await request(app)
        .post('/user/login')
        .send(data)

    expect_success_code(200, res);
    token = res.body.token;
});

describe('Crear libro POST /libro', function () {
    /*describe('Bad requests errors', function () {
        tests.forEach((test: any) => {
            it(test.title, function (done) {
                request(app)
                    .post('/libro')
                    .set('Authorization', `Bearer ${token}`)
                    .send(test.data)
                    .end((_, res) => {
                        if (res.status != test.code){
                            console.log(res.body, res.status);
                        }
                        expect(res.status).toEqual(test.code);
                        expect(res.body).toHaveProperty('success');
                        expect(res.body).toHaveProperty('errors');
                        expect(res.body.success).toEqual(false);
                    done();
                  });
            });
        });
    });*/
    
    it('Crear libro sin personas', async () => {
        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expect_err_code(400, res);
    });
    
    it('Insertar Libro', async () => {
        const personas   = (await request(app)
            .get('/persona/')
            .set('Authorization', `Bearer ${token}`)
            ).body;

        //Autor que agarramos desde la tabla
        libro.personas = [{
            id_persona: personas.at(-1).id,
            porcentaje: 20,
            tipo: "autor"
        }, {
            nombre: "juancito",
            dni: "39019203",
            porcentaje: 25.0,
            tipo: "ilustrador"
        }];

        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expect_success_code(201, res);
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

        expect_err_code(404, res);
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
        expect_success_code(201, res);

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
        for (let persona of libro.personas){
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

        expect(res.status).toEqual(200);
        expect(res.body.success).toEqual(false);
    });

    it('Actualizamos precio', async () => {
        libro.precio += 1100;
        const res = await request(app)
            .put('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expect_success_code(201, res);
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

        expect_success_code(201, res);
    });

    it('Actualizamos una persona que no esta en el libro', async () => {
        let autor_copy = JSON.parse(JSON.stringify(libro.personas[0]));
        autor_copy.id_persona = -1;
        const res = await request(app)
            .put('/libro/'+libro.isbn+'/personas')
            .set('Authorization', `Bearer ${token}`)
            .send(autor_copy);

        expect_err_code(404, res);
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

        expect_success_code(200, res);
    });

    it('Intentar Borrar una persona que no trabaja en el libro', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .set('Authorization', `Bearer ${token}`)
            .send([{
                id_persona: -1,
                tipo: "autor",
            }]);

        expect_err_code(404, res);
    });

    it('Borrado', async () => {
        const res = await request(app)
            .delete('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`);
        expect_success_code(200, res);
    });

    it('No se puede obtener el libro', async () => {
        const res = await request(app)
            .get('/libro/'+libro.isbn)
            .set('Authorization', `Bearer ${token}`);
        expect_err_code(404, res);
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
