import {describe, expect, it} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../../.env");
dotenv.config({path: path});

import {conn} from '../src/db'
import {expect_err_code, expect_success_code} from './util';

const app = 'http://localhost:3001';
import {Cliente} from '../src/models/cliente.model.js';
import { tipoCliente } from '../src/schemas/cliente.schema';

let cliente: any = {};
let token: string;

/*
    - Creamos dos clientes, una con cuit 11111111 y otra 22222222
    - Intentamos crear otra con el mismo cuit y obtenemos un error
    - Obtenemos una cliente con un id q no existe y nos da un error
    - Verificamos que la cliente creada esté en la lista
    - Intentamos actualizar el cliente 1 al cuit de la cliente 2 y obtenemos un error
    - Actualizamos la cliente
    - Intentamos borrar una cliente que no existe, obtenemos un error
    - Borramos la cliente 1
    - Verificamos que ya no esté en la lista
    - Hard delete de las dos clientes para evitar que queden en la DB.
*/

it('Hard delete', async () => {
    let [cliente]: any = await conn.query(`
        SELECT * FROM clientes
        WHERE cuit='30500001735'`
    );

    if (cliente.length == 0){
        return 0;
    }
    let [consignaciones]: any = await conn.query(`
        SELECT * FROM consignaciones
        WHERE id_cliente=${cliente[0].id}
    `);

    for (let consigna of consignaciones){
        await conn.query(`
            DELETE FROM libros_consignaciones
            WHERE id_consignacion=${consigna.id}
        `);
        await conn.query(`
            DELETE FROM consignaciones
            WHERE id=${consigna.id}
        `);
    }
    await conn.query(`
        DELETE FROM stock_cliente
        WHERE id_cliente=${cliente[0].id}
    `);

    await conn.query(`
        DELETE FROM clientes
        WHERE cuit=30500001735`
    );
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

describe('POST cliente/', () => {
    it('Sin nombre', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        cliente.nombre = 'Test';
        cliente.email = 'test@gmail.com';
        
        expect_err_code(400, res);
    });

    it('consumidor final', async () => {
        cliente.tipo = tipoCliente.particular;
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        cliente.tipo = 'inscripto';
        
        expect_err_code(400, res);
    });

    it('Sin cuit', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        cliente.cuit = '11111111';
        
        expect_err_code(400, res);
    });

    it('Persona no está cargada en Afip', async () => {        
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        cliente.cuit = '30710813082';
        
        expect_err_code(404, res);
    });


    it('Success', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        expect_success_code(201, res);

        cliente.id = res.body.data.id;
    });

    it('cuit repetido', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        expect_err_code(404, res);
    });
});

describe('GET cliente/', () => {
    it('cliente que no existe', async () => {
        const res = await request(app)
            .get('/cliente/'+(cliente.id+2))
            .set('Authorization', `Bearer ${token}`);

        expect_err_code(404, res);
    });

    it('Obtener cliente', async () => {
        const res = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toEqual(200);
        expect(res.body).toMatchObject(cliente);
    });

    it('La cliente está en la lista', async () => {
        const res = await request(app)
            .get('/cliente/')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toEqual(200);
        expect(res.body.map((p: any) => p.id)).toContain(cliente.id);
    });

    it('consumidor final', async () => {
        const res = await request(app)
            .get('/cliente/consumidor_final')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
    });
});

describe('PUT cliente/{id}', () => {
    it('Nothing changed', async () => {
        delete cliente.cuit;
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect(res.status).toEqual(200);
    });

    it('Actualizar nombre y email', async () => {
        cliente.nombre = 'Test nro 2';

        let req = Object.assign({}, cliente);
        
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(req);
        
        expect_success_code(201, res);
        expect(res.body.data.nombre).toEqual(cliente.nombre);
    });

    it('Los datos fueron actualizados correctamente', async () => {
        //console.log("PUT", cliente);
        const res = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body).toMatchObject(cliente);       
    });

    it('Actualizar a un cuit que no esta en afip', async () => {
        cliente.cuit = '12345';
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect_err_code(404, res);
    });

    it('Actualizar a un cuit que ya esta cargado', async () => {
        let res = await request(app)
            .get('/cliente/')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.at(-2)).toHaveProperty('cuit');

        cliente.cuit = '20434919798';
        
        res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect_err_code(404, res);
        expect(res.body.errors[0].message).toEqual(`El cliente con cuit ${cliente.cuit} ya existe`);
    });

    it('Actualizar el cuit', async () => {
        cliente.cuit = '30500001735';
        cliente.este_campo_no_va = "anashe23";

        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);
        
        cliente = res.body.data;

        expect_success_code(201, res);
    });

    it('El cuit se actualizo correctamente', async () => {
        const res = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);

        delete cliente.tipo;
        expect(res.body).toMatchObject(cliente);       
    });
});