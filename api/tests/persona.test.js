import request from 'supertest';
import chai from 'chai';

import {expect_err_code, expect_success_code} from './util.js';

import {conn} from '../src/db.js'


let persona = {}
const app = 'http://localhost:3001'

/*
    - Creamos dos personas, una con dni 11111111 y otra 22222222
    - Intentamos crear otra con el mismo dni y obtenemos un error
    - Obtenemos una persona con un id q no existe y nos da un error
    - Verificamos que la persona creada esté en la lista
    - Intentamos actualizar la persona 1 al dni de la persona 2 y obtenemos un error
    - Actualizamos la persona
    - Intentamos borrar una persona que no existe, obtenemos un error
    - Borramos la persona 1
    - Verificamos que ya no esté en la lista
    - Hard delete de las dos personas para evitar que queden en la DB.
*/

describe('POST persona/', () => {
    it('Sin nombre', async () => {
        const res = await request(app).post('/persona/').send(persona);
        
        persona.nombre = 'Test';
        persona.email = 'test@gmail.com'
        expect_err_code(400, res);
    });

    it('Sin dni', async () => {
        const res = await request(app)
            .post('/persona/')
            .send(persona);
        
        persona.dni = '11111111';
        
        expect_err_code(400, res);
    });


    it('Success', async () => {
        const res = await request(app).post('/persona/').send(persona);

        // Creo otra persona para despues
        persona.dni = '22222222';
        await request(app).post('/persona/').send(persona);

        persona.dni = '11111111';
        persona.id = res.body.data.id;
        
        expect_success_code(201, res);
    });

    it('Dni repetido', async () => {
        const res = await request(app).post('/persona/').send(persona);
        
        expect_err_code(404, res);
    });
});


describe('GET persona/', () => {
    it('Persona que no existe', async () => {
        const res = await request(app).get('/persona/'+(persona.id+2));

        expect_err_code(404, res);
    });

    it('Obtener persona', async () => {
        const res = await request(app).get('/persona/'+persona.id);

        chai.expect(res.status).to.equal(200);
        chai.expect(res.body).to.deep.include(persona);
    });

    it('La persona está en la lista', async () => {
        const res = await request(app).get('/persona/');

        chai.expect(res.status).to.equal(200);
        chai.expect(res.body.map(p => p.id)).to.deep.include(persona.id);
    });
});

describe('PUT persona/{id}', () => {
    it('Nothing changed', async () => {
        delete persona.dni;
        const res = await request(app).put('/persona/'+persona.id).send(persona);

        chai.expect(res.status).to.equal(200);
    });

    it('Actualizar a un dni que ya está cargado', async () => {
        persona.dni = '22222222';
        const res = await request(app).put('/persona/'+persona.id).send(persona);

        expect_err_code(404, res);
    });

    it('Success', async () => {
        persona.dni='11111111'
        persona.nombre = 'TestTest';
        persona.este_campo_no_va = "anashe23";

        const res = await request(app).put('/persona/'+persona.id).send(persona);
        expect_success_code(201, res);

        delete persona.este_campo_no_va;
        res.body.data.id = persona.id;
        chai.expect(res.body.data).to.deep.include(persona);
    });

})

describe('DELETE /persona/{id}', () => {
    it('Persona no existe', async () => {
        const res = await request(app).get('/persona/'+(persona.id+2));

        expect_err_code(404, res);
    });
    
    it('Success', async () => {
        const res = await request(app).delete('/persona/'+persona.id);

        chai.expect(res.status).to.equal(200);
    });

    it('La persona ya no está en la lista', async () => {
        const res = await request(app).get('/persona/');

        chai.expect(res.status).to.equal(200);
        chai.expect(res.body.map(p => p.id)).to.not.include(persona.id);
    });

    it('HARD DELETE', async () => {
        await conn.query(`
            DELETE FROM personas
            WHERE dni=11111111
            OR dni=22222222
        `);
    });
    
  });
