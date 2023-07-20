import request from 'supertest';
import chai from 'chai';

process.env.DB_HOST = "localhost",
process.env.DB_USER = "teti",
process.env.DB_PASS = "Lautaro123.",
process.env.DB_NAME = "librossilvestres"
import {conn} from '../src/db.js'

import {expect_err_code, expect_success_code} from './util.js';
import {Cliente} from '../src/models/cliente.model.js';

let cliente = {};
let token;
const app = 'http://localhost:3001';

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
    await conn.query(`
        DELETE FROM clientes
        WHERE cuit=30500001735`
    );
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
        cliente.tipo = Cliente.particular;
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        delete cliente.tipo;
        
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
        
        cliente.cuit = '20434919798';
        
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
        
        chai.expect(res.status).to.equal(200);
        chai.expect(res.body).to.deep.include(cliente);
    });

    it('La cliente está en la lista', async () => {
        const res = await request(app)
            .get('/cliente/')
            .set('Authorization', `Bearer ${token}`);
        
        chai.expect(res.status).to.equal(200);
        chai.expect(res.body.map(p => p.id)).to.deep.include(cliente.id);
    });

    it('consumidor final', async () => {
        const res = await request(app)
            .get('/cliente/consumidor_final')
            .set('Authorization', `Bearer ${token}`);

        chai.expect(res.status).to.equal(200);
    });
});

describe('PUT cliente/{id}', () => {
    it('Nothing changed', async () => {
        delete cliente.cuit;
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        chai.expect(res.status).to.equal(200);
    });

    it('Actualizar nombre y email', async () => {
        cliente.cuit = '20434919798';
        cliente.nombre = 'Test nro 2';

        let req = Object.assign({}, cliente);
        req.razon_social = "no se debe actualizar";
        req.cond_fiscal = "no se debe actualizar";
        req.tipo = 0; //No se debe actualizar
        
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(req);
        
        expect_success_code(201, res);
    });

    it('Los datos fueron actualizados correctamente', async () => {
        //console.log("PUT", cliente);
        const res = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        chai.expect(res.status).to.equal(200);

        chai.expect(res.body).to.deep.include(cliente);       
    });

    it('Actualizar a un cuit que no esta en afip', async () => {
        cliente.cuit = '1111111111';
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect_err_code(404, res);
    });

    it('Actualizar el cuit', async () => {
        cliente.cuit = '30500001735';
        cliente.este_campo_no_va = "anashe23";

        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);
        
        console.log(res.body);
        cliente = res.body.data;

        expect_success_code(201, res);
    });

    it('El cuit se actualizo correctamente', async () => {
        const res = await request(app)
        .get('/cliente/'+cliente.id)
        .set('Authorization', `Bearer ${token}`);

        chai.expect(res.status).to.equal(200);

        delete cliente.tipo;
        chai.expect(res.body).to.deep.include(cliente);       
    });

});