import request from 'supertest';
import chai from 'chai';

process.env.DB_HOST = "localhost",
process.env.DB_USER = "teti",
process.env.DB_PASS = "Lautaro123.",
process.env.DB_NAME = "librossilvestres"
import {conn} from '../src/db.js'

import {expect_err_code, expect_success_code} from './util.js';

const app = 'http://localhost:3001'

let token;
let libro = {
    "isbn": "111111111",
    "titulo": "Test",
    "fecha_edicion": "2020-02-17",
    "precio": 10000
}


it('HARD DELETE', async () => {
    let res = (await conn.query(`
        SELECT isbn FROM libros
        WHERE isbn=${libro.isbn}
    `))[0];

    if (res.length){
        let personas = (await conn.query(`
            SELECT * FROM libros_personas
            WHERE isbn=${libro.isbn}
        `))[0];

        await conn.query(`
            DELETE FROM libros_personas
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
        password: '$2b$10$CJ4a/b08JS9EfyvWKht6QOSRKuT4kb2CUvkRwEIzwdCuOmFyrYTdK'
    }
    const res = await request(app)
        .post('/user/login')
        .send(data)

    expect_success_code(200, res);
    token = res.body.token;
});

it('Insertar Libro', async () => {
    let personas   = (await request(app)
        .get('/persona/')
        .set('Authorization', `Bearer ${token}`)
        ).body;

    //Autor que agarramos desde la tabla
    libro.autores = [{
        id: personas.at(-1).id,
        porcentaje: 20,
    }]

    //Creamos un nuevo ilustrador
    libro.ilustradores = [{
        nombre: "juancito",
        dni: "39019203",
        porcentaje: 25.0
    }];

    const res = await request(app)
        .post('/libro/')
        .set('Authorization', `Bearer ${token}`)
        .send(libro);

    expect_success_code(201, res);

    chai.expect(res.body.data).to.have.property("ilustradores");
    chai.expect(res.body.data).to.have.property("autores");        

    libro.ilustradores[0].id = res.body.data.ilustradores[0].id;
    libro.personas = libro.autores.concat(libro.ilustradores);
});

describe('Crear liquidacion POST /liquidacion', function () {
    it('La persona no trabaja en el libro', async () => {
        let req = {
            "isbn": libro.isbn,
            "fecha_inicial": "2020-06-15",
            "fecha_final": "2026-01-01",
            "id_persona": libro.personas[0].id,
            "tipo_persona": libro.personas[0].tipo === 0 ? 1 : 0
        }

        const res = await request(app)
            .post('/liquidacion/')
            .set('Authorization', `Bearer ${token}`)
            .send(req);

        expect_err_code(404, res);
    });
});