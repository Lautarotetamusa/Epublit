import request from 'supertest';
import chai from 'chai';
import fs from "fs"

process.env.DB_HOST = "localhost",
process.env.DB_USER = "teti",
process.env.DB_PASS = "Lautaro123.",
process.env.DB_NAME = "librossilvestres"
import {conn} from '../src/db.js'

import {expect_err_code, expect_success_code} from './util.js';

const app = 'http://localhost:3001'

const rawdata = fs.readFileSync("tests/libro.test.json");
const tests = JSON.parse(rawdata);


let libro = {
    "isbn": "111111111",
    "titulo": "Test",
    "fecha_edicion": "2020-02-17",
    "precio": 10000
}

before('HARD DELETE', async () => {
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

describe('Crear libro POST /libro', function () {
    describe('Bad requests errors', function () {
        tests.forEach(test => {
            it(test.title, function (done) {
                request(app)
                    .post('/libro')
                    .send(test.data)
                    .end((err, res) => {
                        if (res.status != test.code){
                            console.log(res.body, res.status);
                        }
                        chai.expect(res.status).to.equal(test.code);
                        chai.expect(res.body).to.be.a('object');
                        chai.expect(res.body).to.have.property('success');
                        chai.expect(res.body).to.have.property('error');
                        chai.expect(res.body.success).to.be.false;
                    done();
                  });
            });
        });
    });
    
    it('Crear libro sin personas', async () => {
        const res = await request(app)
            .post('/libro/')
            .send(libro);

        expect_err_code(400, res);
    });
    
    it('Insertar Libro', async () => {
        let personas   = (await request(app).get('/persona/')).body;

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
        }]

        const res = await request(app)
            .post('/libro/')
            .send(libro);

        libro.ilustradores[0].id = res.body.data.ilustradores[0].id;

        expect_success_code(201, res);
    });

    it('Insertar la misma persona que antes', async () => {
        const personas = {...libro.autores[0], tipo: 0};

        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .send(personas);

        expect_err_code(404, res);
    });

    it('Agregar personas', async () => {
        //Get real persons from the table
        let personas   = (await request(app).get('/persona/')).body;

        personas = [{
            id: personas.at(0).id,
            porcentaje: 20.1,
            tipo: 0
        },
        {
            id: personas.at(1).id,
            porcentaje: 25.5,
            tipo: 1
        }]

        const res = await request(app)
            .post(`/libro/${libro.isbn}/personas`)
            .send(personas);

        expect_success_code(201, res);
        
        libro.autores = res.body.data.autores;
        libro.ilustradores = res.body.data.ilustradores;
        libro.personas = libro.autores.concat(libro.ilustradores);
    });

    it('El libro tiene las personas cargadas con todos los datos', async() => {
        const res = (await request(app).get(`/libro/${libro.isbn}`)).body;
        //console.log(res);
        //console.log(libro);
        chai.expect(res.autores.map(p => p.id)).to.eql(libro.autores.map(p => p.id));
        chai.expect(res.ilustradores.map(p => p.id)).to.eql(libro.ilustradores.map(p => p.id));
    });

    it('Las personas tienen el libro asignado', async () => {
        for (let persona of libro.personas){

            let res = (await request(app).get('/persona/'+persona.id));
            chai.expect(res.status).to.eql(200);

            chai.expect(res.body).to.have.property('libros');

            const libros = res.body.libros;

            //Revisar que los autores e ilustradores tengan ese libro asociado
            chai.expect(libros.map(l => l.isbn)).to.deep.include(libro.isbn);
        }
    });
});

describe('Obtener libro GET /libro/:isbn', function () {
    it("Libro obtenido", function (done) {
        request(app)
        .get('/libro/'+libro.isbn)
        .expect(200, done)
    });

    it("Intentar obtener libro que no existe", function (done) {
        request(app)
        .get('/libro/'+libro.isbn+1)
        .expect(404, done)
    });
});

describe('Actualizar libro PUT /libro/:isbn', function () {
    it('Todo es igual', async () => {
        const res = await request(app)
            .put('/libro/'+libro.isbn)
            .send(libro);

        chai.expect(res.status).to.equal(200);
        chai.expect(res.body.success).to.be.false;
    });

    it('Actualizamos precio', async () => {
        libro.precio += 1100;
        const res = await request(app).put('/libro/'+libro.isbn).send(libro);

        expect_success_code(201, res);
    });

    it('Actualizamos una persona', async () => {
        const res = await request(app).put('/libro/'+libro.isbn+'/personas').send(libro.personas);

        expect_success_code(201, res);
    });

    it('Actualizamos una persona que no esta en el libro', async () => {
        let autor_copy = JSON.parse(JSON.stringify(libro.autores[0]));
        autor_copy.id = -1;
        const res = await request(app)
            .put('/libro/'+libro.isbn+'/personas')
            .send(autor_copy);

        expect_err_code(404, res);
    });
});

describe('DELETE /libro', function () {
    it('Borrar una persona del libro', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .send([{
                ...libro.personas[0],
                tipo: 0,
            }]);

        expect_success_code(200, res);
    });

    it('Intentar Borrar una persona que no trabaja en el libro', async () => {
        const res = await request(app)
            .delete(`/libro/${libro.isbn}/personas`)
            .send([{
                id: -1,
                tipo: 0,
            }]);

        expect_err_code(404, res);
    });

    it('Borrado', async () => {
        const res = await request(app).delete('/libro/'+libro.isbn);
        expect_success_code(200, res);
    });

    it('No se puede obtener el libro', async () => {
        const res = await request(app).get('/libro/'+libro.isbn);
        expect_err_code(404, res);
    });

    it('Las personas no tienen más el libro asignado', async () => {

        let autor       = (await request(app).get('/persona/'+libro.personas[0].id)).body;
        //console.log(autor);
        let ilustrador  = (await request(app).get('/persona/'+libro.personas[1].id)).body;
        //console.log(ilustrador);

        //Revisar que los autores e ilustradores tengan ese libro asociado
        chai.expect(     autor.libros.map(l => l.isbn)).to.not.deep.include(libro.isbn);
        chai.expect(ilustrador.libros.map(l => l.isbn)).to.not.deep.include(libro.isbn);
    });

});

describe('Listar todos los libros GET /libro', function () {
    it("Lista obtenida", function (done) {
        request(app)
        .get('/libro')
        .expect(200, done)
    });
});
