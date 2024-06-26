import {describe, expect, it} from '@jest/globals';
import request from "supertest";
import fs from 'fs';

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../../.env");
dotenv.config({path: path});

import {conn} from '../src/db'
import {delay, expect_err_code, expect_success_code} from './util';
import { tipoCliente } from '../src/schemas/cliente.schema';

const app = `${process.env.PROTOCOL}://${process.env.SERVER_HOST}:${process.env.BACK_PUBLIC_PORT}`;
console.log(app);

let token: string;
let cliente: any = {
    cuit: '20442317632',
    nombre: "ClienteTest",
    email: "clientetest@gmail.com",
    tipo: tipoCliente.inscripto,
}
let consignacion: any = {
    libros: [],
}

/*
    - Crear un cliente nuevo
    - Seleccionar 3 libros de la pagina 5 de libros /libros?page=5
    - Setear el stock de esos 3 libros en 3
    - Chequear errores de bad request
    - Realizar la consignacion
    - Revisar que los 3 libros tenga ahora stock 0
    - Revisar que la factura haya sido emitida (que exista el archivo)
    - Revisar que el total de la consignacion sea correcto
    - Revisar que el cliente tenga la consignacion en /cliente/{id}/consignacions
*/

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

describe('CONSIGNACION', () => {
    it('Hard delete consignaciones', async () => {
        let [clientes]: any = await conn.query(`
            SELECT * FROM clientes
            WHERE cuit='${cliente.cuit}'`
        );

        expect(clientes.length).toBeGreaterThan(0);

        expect(clientes[0]).toHaveProperty('id');
        const id_cliente = clientes[0].id;

        //Buscamos la ultima venta creada
        const [transactions]: any = await conn.query(`
            SELECT id FROM transacciones
            WHERE id_cliente=${id_cliente}
            ORDER BY id DESC;
        `);

        /*Borrar de la base de datos*/
        for (let transaction of transactions){
            await conn.query(`
                DELETE FROM libros_transacciones
                WHERE id_transaccion=${transaction.id}
            `);
            await conn.query(`
                DELETE FROM ventas
                WHERE id_transaccion=${transaction.id};
            `);
            await conn.query(`
                DELETE FROM transacciones
                WHERE id=${transaction.id}
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

        const [_] = await conn.query(`
            DELETE FROM clientes
            WHERE id=${id_cliente}`
        );
    });

    describe('Cargar datos para la consignacion', () => {
        it('Crear nuevo cliente', async () => {
            const res = await request(app)
                .post('/cliente/')
                .set('Authorization', `Bearer ${token}`)
                .send(cliente);

            expect_success_code(201, res);

            cliente.id = res.body.data.id;
            consignacion.cliente = cliente.id;
        });

        it('Seleccionar libros para la consignacion', async () => {
            const res = await request(app)
                .get('/libro')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toEqual(200);
            consignacion.libros = [ res.body[3], res.body[5], res.body[8] ];
        });

        it('Agregar stock a los libros', async () => {
            let stock = 3;
            
            for (const libro of consignacion.libros) {
                let res = await request(app)
                    .put(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        stock: 0
                    });

                res = await request(app)
                    .put(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        stock: stock
                    });

                libro.cantidad = stock;

                expect_success_code(201, res);
            }

            for (const libro of consignacion.libros) {
                const res = await request(app)
                    .get(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toEqual(200);

                expect(res.body.stock).toEqual(stock);
            }    
        });
    });

    describe('POST /consignacion', () => {
        describe('Bad request', () => {
            it('Consignacion no tiene cliente', async () => {
                const req = {libros: consignacion.libros};

                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(req);
                expect_err_code(400, res);
            });

            it('Un libro no tiene suficiente stock', async () => {
                consignacion.libros[2].cantidad = 5;

                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(consignacion);
                expect_err_code(400, res);

                consignacion.libros[2].cantidad = 3;
            });

            it('No se debe poder consignar a un cliente consumidor final', async () => {
                const res1 = await request(app)
                    .get('/cliente/consumidor_final')
                    .set('Authorization', `Bearer ${token}`);

                expect(res1.status).toEqual(200);
                const consumidor_final = res1.body;

                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        ...consignacion,
                        cliente: consumidor_final.id
                    });

                expect_err_code(400, res);
            });
        });

        describe('consignacion exitosa', () => {
            it('Consignar', async () => {
                //console.log("consignacion: ", consignacion);
                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(consignacion);
            
                expect_success_code(201, res);
            });

            it('Los libros reducieron su stock', async () => {
                for (const libro of consignacion.libros) {
                    const res = await request(app)
                        .get(`/libro/${libro.isbn}`)
                        .set('Authorization', `Bearer ${token}`);
        
                    expect(res.status).toEqual(200);
                    expect(res.body.stock).toEqual(0);
                }
            });

            it('El cliente tiene el stock cargado', async () => {
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/stock/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toEqual(200);

                for (const libro of res.body) {
                    expect(libro.stock).toEqual(3);
                }
            });

            /*it('El remito existe y el nombre coincide', async () => {       
                await delay(400);         
                fs.readFile(`../remitos/${consignacion.path}`, 'utf8', (err, _) => {
                    if(err){
                        console.error(err);
                    }
                    expect(err).toBeNull;
                });
            });*/
        });
    });
});