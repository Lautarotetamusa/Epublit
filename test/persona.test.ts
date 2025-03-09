import {describe, expect, it} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

// Usar la DB de testing
process.env.DB_NAME = "epublit_test";
import {app, server} from '../src/app';
import {conn} from '../src/db'
import {expectErrorResponse, expectDataResponse, expectBadRequest, expectCreated, expectNotFound} from './util';

let persona: any = {}
let token: string;

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

afterAll(() => {
    conn.end();
    server.close();
});

it('HARD DELETE', async () => {
    await conn.query(`
        DELETE FROM personas
        WHERE dni=11111111
        OR dni=22222222
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

describe('POST persona/', () => {
    it('Sin nombre', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(persona);

        persona.nombre = 'Test';
        persona.email = 'test@gmail.com'
        expectBadRequest(res);
    });

    it('Sin dni', async () => {        
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(persona);
        
        persona.dni = '11111111';
        
        expectBadRequest(res);
    });


    it('Success', async () => {
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(persona);

        // Creo otra persona para despues
        persona.dni = '22222222';
        await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(persona);

        expectCreated(res);
        
        persona.dni = '11111111';
        persona.id = res.body.data.id;
    });

    it('Dni repetido', async () => {
        let _persona = Object.assign({}, persona);
        delete _persona.id;
        const res = await request(app)
            .post('/persona/')
            .set('Authorization', `Bearer ${token}`)
            .send(_persona);
        
        expectNotFound(res);
    });
});

describe('GET persona/', () => {
    it('Persona que no existe', async () => {
        const res = await request(app)
            .get('/persona/'+(persona.id+2))
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    it('Obtener persona', async () => {
        const res = await request(app)
            .get('/persona/'+persona.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body).toMatchObject(persona);
    });

    it('La persona está en la lista', async () => {
        const res = await request(app)
            .get('/persona/')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.map((p: any) => p.id)).toContain(persona.id);
    });
});

describe('PUT persona/{id}', () => {
    it('Nothing changed', async () => {
        let _persona = Object.assign({}, persona);
        delete _persona.id;
        delete _persona.dni;

        const res = await request(app)
            .put('/persona/'+persona.id)
            .set('Authorization', `Bearer ${token}`)
            .send(_persona);

        expect(res.status).toEqual(201);
    });

    it('Actualizar a un dni que ya está cargado', async () => {
        let _persona = Object.assign({}, persona);
        delete _persona.id;
        _persona.dni = '22222222';
        const res = await request(app)
            .put('/persona/'+persona.id)
            .set('Authorization', `Bearer ${token}`)
            .send(_persona);

        expectNotFound(res);
    });

    it('Actualizar campo que no existe', async () => {
        let data = {no_existe: 99, nombre: "hola"}

        const res = await request(app)
            .put('/persona/'+persona.id)
            .set('Authorization', `Bearer ${token}`)
            .send(data);
        expectCreated(res);
    });

    it('Success', async () => {
        persona.dni='11111111'
        persona.nombre = 'TestTest';
        let _persona = Object.assign({}, persona);
        delete _persona.id;

        const res = await request(app)
            .put('/persona/'+persona.id)
            .set('Authorization', `Bearer ${token}`)
            .send(_persona);

        expectCreated(res);

        res.body.data.id = persona.id;
        expect(res.body.data).toMatchObject(persona);
    });
})

describe('DELETE /persona/{id}', () => {
    it('Persona no existe', async () => {
        const res = await request(app)
            .get('/persona/'+(persona.id+1000))
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });
    
    it('Success', async () => {
        const res = await request(app)
            .delete('/persona/'+persona.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
    });

    it('La persona ya no está en la lista', async () => {
        const res = await request(app)
            .get('/persona/')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.map((p: any) => p.id)).not.toContain(persona.id);
    });    
  });
