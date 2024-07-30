import {describe, expect, test} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../../.env");
dotenv.config({path: path});

import {conn} from '../src/db'
import {delay, expect_err_code, expect_success_code} from './util';

const app = `${process.env.PROTOCOL}://${process.env.SERVER_HOST}:${process.env.BACK_PUBLIC_PORT}`;
console.log(app);
import { tipoCliente } from '../src/schemas/cliente.schema';
import { RowDataPacket } from 'mysql2';

const cuit = "30500001735"
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

afterAll(async () => {
    conn.end();
})

test('Hard delete', async () => {
    const [clientes] = await conn.query<RowDataPacket[]>(`
        SELECT * FROM clientes
        WHERE cuit='${cuit}'`
    );

    if (clientes.length == 0){
        return 0;
    }
    const id_cliente = clientes[0].id;

    let [consignaciones]: any = await conn.query(`
        SELECT * FROM transacciones
        WHERE id_cliente=${id_cliente}
        AND type = 'consignacion'
    `);

    for (let consigna of consignaciones){
        await conn.query(`
            DELETE FROM libros_transacciones
            WHERE id_transaccion=${consigna.id}
        `);
        await conn.query(`
            DELETE FROM transacciones
            WHERE id=${consigna.id}
        `);
    }
    await conn.query(`
        DELETE FROM libro_cliente
        WHERE id_cliente=${id_cliente}
    `);

    await conn.query(`
        DELETE FROM precio_libro_cliente
        WHERE id_cliente=${id_cliente}
    `);

    await conn.query(`
        DELETE FROM clientes
        WHERE id=${id_cliente}`
    );
    await conn.query(`
        DELETE FROM clientes
        WHERE cuit=${cuit}`
    );
});

test('login', async () => {
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
    test('Sin nombre', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        cliente.nombre = 'Test';
        cliente.email = 'test@gmail.com';
        
        expect_err_code(400, res);
    });

    test('consumidor final', async () => {
        cliente.tipo = tipoCliente.particular;
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        cliente.tipo = 'inscripto';
        
        expect_err_code(400, res);
    });

    test('Sin cuit', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        cliente.cuit = '11111111';
        
        expect_err_code(400, res);
    });

    test('Persona no está cargada en Afip', async () => {        
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        expect_err_code(404, res);
    }, 10000);


    test('Success', async () => {
        cliente.cuit = "30710813082";

        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        expect_success_code(201, res);

        cliente.id = res.body.data.id;
    }, 10000);

    test('cuit repetido', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);
        
        expect_err_code(404, res);
    });
});

describe('GET cliente/', () => {
    test('cliente que no existe', async () => {
        const res = await request(app)
            .get('/cliente/'+(cliente.id+2))
            .set('Authorization', `Bearer ${token}`);

        expect_err_code(404, res);
    });

    test('Obtener cliente', async () => {
        const res = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toEqual(200);
        expect(res.body).toMatchObject(cliente);
    });

    test('Obtener clientes de un tipo', async () => {
        const res = await request(app)
            .get('/cliente?tipo=inscripto')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toEqual(200);
        for (const c of res.body){
            expect(c.tipo).toBe("inscripto")
        }
    });

    test('La cliente está en la lista', async () => {
        const res = await request(app)
            .get('/cliente/')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.status).toEqual(200);
        expect(res.body.map((p: any) => p.id)).toContain(cliente.id);
    });

    test('consumidor final', async () => {
        const res = await request(app)
            .get('/cliente/consumidor_final')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
    });
});

describe('Stock cliente', () => {
    test('El cliente no tiene stock', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('length');
        expect(res.body.length).toBe(0);
    });

    test('Realizamos una consignacion', async () => {
        const consignacion = {
            libros: [{
                isbn: "9789874201096",
                cantidad: 3
            }],
            cliente: cliente.id
        }

        const res = await request(app)
            .post('/consignacion/')
            .set('Authorization', `Bearer ${token}`)
            .send(consignacion);

        expect_success_code(201, res);
    });

    let precio = 0;
    let updateTime: string;
    test('El cliente tiene el stock cargado', async () => {
        let res = await request(app)
            .get(`/cliente/${cliente.id}/stock/`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toEqual(200);

        const res1 = await request(app)
            .get(`/libro/9789874201096`)
            .set('Authorization', `Bearer ${token}`);

        expect(res1.status).toEqual(200);
        expect(res1.body).toHaveProperty('precio');
        precio = res1.body.precio;

        for (const libro of res.body) {
            expect(libro.stock).toEqual(3);
            expect(libro.precio).toEqual(precio);
        }
    });

    test('Se actualiza el precio del cliente', async () => {
        const libro = {
            precio: precio + 100
        }

        //Actualizar precio del libro en stock general
        const resLibro = await request(app)
            .put('/libro/9789874201096')
            .set('Authorization', `Bearer ${token}`)
            .send(libro);

        expect_success_code(201, resLibro);
        await delay(1000);  // Esperamos 1s para que haya dos fechas de actualizacion distintas

        //Actualizar precio del libro del stock del cliente
        let res = await request(app)
            .put(`/cliente/${cliente.id}/stock/`)
            .set('Authorization', `Bearer ${token}`);
        let d = new Date();
        //TODO: No hardcodear la zona horaria de argentina
        d.setHours(d.getHours() - 3); //Restamos 3 horas porque estamos en GMT-3
        updateTime = d.toISOString().split('.')[0];

        expect(res.status).toEqual(200);
    });

    test('Precio actualizado correctamente', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock/`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toEqual(200);

        const libro = res.body.find((l: any) => l.isbn == "9789874201096");
        expect(libro.stock).toEqual(3);
        expect(libro.precio).toEqual(precio+100);
    });

    test('Precio anterior a la fecha de actualizacion', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock?fecha=${updateTime}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toEqual(200);

        const libro = res.body.find((l: any) => l.isbn == "9789874201096");
        expect(libro).not.toBeUndefined();
        expect(libro.stock).toEqual(3);
        expect(libro.precio).toEqual(precio);
    });
});

describe('PUT cliente/{id}', () => {
    test('Nothing changed', async () => {
        delete cliente.cuit;
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect(res.status).toEqual(201);
    });

    test('Actualizar nombre y email', async () => {
        cliente.nombre = 'Test nro 2';

        let req = Object.assign({}, cliente);
        
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(req);
        
        expect_success_code(201, res);
        expect(res.body.data.nombre).toEqual(cliente.nombre);

        const res1 = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res1.status).toEqual(200);
        expect(res1.body).toMatchObject(cliente);       
    });

    test('Actualizar a un cuit que no esta en afip', async () => {
        cliente.cuit = '12345';
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect_err_code(404, res);
    }, 10000);

    test('Actualizar a un cuit que ya esta cargado', async () => {
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

    test('Actualizar el cuit', async () => {
        cliente.cuit = cuit;
        cliente.este_campo_no_va = "anashe23";

        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);
        
        cliente = res.body.data;

        expect_success_code(201, res);

        const res2 = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res2.status).toEqual(200);

        delete cliente.tipo;
        expect(res2.body).toMatchObject(cliente);       
    }, 10000);
});
