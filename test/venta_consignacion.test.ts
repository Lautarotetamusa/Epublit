import {describe, expect, test} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

import {conn} from '../src/db'
import {delay, expect_err_code, expect_success_code} from './util';

const app = `${process.env.PROTOCOL}://${process.env.SERVER_HOST}:${process.env.BACK_PUBLIC_PORT}`;
console.log(app);
let token: string;

let cliente: any = {}; 
let venta: any = {
    tipo_cbte: 11,
    fecha_venta: Date.now() 
}; 
const id_cliente = 42; //Cliente inscripto
let oldLibros: any = [];
let libros: any = [];

/*
    - Crear un cliente nuevo
    - Seleccionar 3 libros de la pagina 5 de libros /libros?page=5.
    - Setear el stock de esos 3 libros en 6
    - Consignar esos 3 libros con stock 3.

    - Realizar la venta
    - Revisar que los 3 libros tenga ahora stock 3
    - Revisar que la factura haya sido emitida (que exista el archivo)
    - Revisar que el total de la venta sea correcto
    - Revisar que el cliente tenga la venta en /cliente/{id}/ventas

    - Actualizar los precios de los libros
    - Realizar venta consignacion con fecha_venta anterior a la actualizacion
    - Revisar que los 3 libros tenga ahora stock 0
    - Revisar que la factura haya sido emitida (que exista el archivo)
    - Revisar que el total de la venta sea correcto, tine que tener el precio anterior
    - Revisar que el cliente tenga la venta en /cliente/{id}/ventas
*/

afterAll(() => {
    conn.end();
});

it.concurrent('login', async () => {
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

describe('VENTA', () => {
    test('delete ventas', async () => {
        //Buscamos la ultima venta creada
        const venta: any = (await conn.query(`
            SELECT id FROM transacciones
            WHERE id_cliente=${id_cliente}
            ORDER BY id DESC;
        `))[0];

        if (!Array.isArray(venta) || venta.length <= 0 || !('id' in venta[0])){
            return;
        }
        const id = venta[0].id;

        /*Borrar de la base de datos*/
        await conn.query(`
            DELETE FROM libros_transacciones
            WHERE id_transaccion=${id};
        `);
        await conn.query(`
            DELETE FROM ventas
            WHERE id_transaccion=${id};
        `);
        await conn.query(`
            DELETE FROM transacciones
            WHERE id=${id};
        `);
    });

    describe('Cargar datos para la venta', () => {
        test('Buscar cliente', async () => {
            const res = await request(app)
                .get(`/cliente/${id_cliente}`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toEqual(200);

            cliente = res.body;
            venta['cliente'] = cliente.id;
        });

        test('Seleccionar libros para la venta', async () => {
            const res = await request(app)
                .get('/libro')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toEqual(200);

            libros = [
                res.body.find((l: any) => l.isbn ==  '11111112'), 
                res.body.find((l: any) => l.isbn ==  '11111115'), 
                res.body.find((l: any) => l.isbn ==  '11111116')
            ];

            venta.libros = [{
                isbn: '11111112',
                cantidad: 3
            },{
                isbn: '11111115',
                cantidad: 3
            },{
                isbn: '11111116',
                cantidad: 3
            }];
        });

        test('Agregar stock a los libros', async () => {
            let stock = 6;
            
            for (const libro of venta.libros) {
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

                expect_success_code(201, res);
            }

            for (const libro of venta.libros) {
                const res = await request(app)
                    .get(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toEqual(200);
                expect(res.body.stock).toEqual(stock);
            }    
        });

        test('Consignarle libros al cliente', async () => {
            const consignacion: any = {
                libros: venta.libros,
                cliente: cliente.id
            }

            const res = await request(app)
                .post('/consignacion/')
                .set('Authorization', `Bearer ${token}`)
                .send(consignacion);
        
            expect_success_code(201, res);
        });

        test('Actualizar el precio de los libros local', async() => {
            oldLibros = JSON.parse(JSON.stringify(libros)); //Copia profunda del array
            for (const libro of libros){
                libro.precio += 1000;
                const res = await request(app)
                    .put('/libro/'+libro.isbn)
                    .set('Authorization', `Bearer ${token}`)
                    .send(libro);

                expect_success_code(201, res);
            }
        });
    
        test('Actualizar el precio de los libros del cliente', async() => {
            let res = await request(app)
                .put(`/cliente/${cliente.id}/stock`)
                .set('Authorization', `Bearer ${token}`);
            expect_success_code(200, res);

            res = await request(app)
                .get(`/cliente/${cliente.id}/stock`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);

            //Chequear que el precio se haya incrementado en 1000
            for (const libro of oldLibros){
                const finded = res.body.find((l: any) => l.isbn == libro.isbn);
                expect(finded).not.toBeNull();
                expect(finded).toHaveProperty('stock');
                expect(finded).toHaveProperty('precio');
                expect(finded.precio).toBe(libro.precio + 1000);
            }
        });
    });

    describe('Cargar venta con precio actual', () => {
        describe('Bad request', () => {
            test('Venta no tiene cliente', async () => {
                let aux_cliente = venta.cliente;
                delete venta.cliente;

                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);

                venta.cliente = aux_cliente;
            });
            test('Venta no tiene libros', async () => {
                let aux_venta = Object.assign({}, venta.libros);
                delete aux_venta.libros;

                let res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(aux_venta);
                expect_err_code(400, res);

                aux_venta.libros = [];

                res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(aux_venta);
                expect_err_code(400, res);
            });
            test('Medio de pago incorrecto', async () => {
                venta.medio_pago = '';
                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);
        
                venta.medio_pago = 'efectivo';
            });
            test('Un libro no tiene suficiente stock', async () => {
                venta.libros[0].cantidad = 5;

                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);

                venta.libros[0].cantidad = 3;
            }, 10000);
        });

        describe('Venta exitosa', () => {
            test('vender', async () => {
                const res: any = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_success_code(201, res);

                expect(res.body.data).toHaveProperty('file_path');
                venta.id = res.body.data.id;
                venta.file_path = res.body.data.file_path;
                expect(res.body.data.id).toEqual(venta.id);
            }, 10000);

            test('Los libros del cliente reducieron su stock', async () => {
                let total = 0;
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/stock/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toBe(200);

                for (const libro of libros){
                    const finded = res.body.find((l: any) => l.isbn == libro.isbn);
                    expect(finded).not.toBeNull();
                    expect(finded).toHaveProperty('stock');
                    expect(finded.stock).toBe(0);
                }

                venta.total = total;
            });

            //TODO: Las ventas consignacion no aparecen
            /*test('El total de la venta está bien', async () => {
                let total = 0;

                let res = await request(app)
                    .get(`/cliente/${cliente.id}/stock/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toEqual(200);

                for (const libro of venta.libros) {
                    const _libro = res.body.find((l: any) => l.isbn == libro.isbn);

                    total += libro.cantidad * _libro.precio;
                    total -= total * (venta.descuento ?? 0) * 0.01;
                    total = parseFloat(total.toFixed(2));
                }

                res = await request(app)
                    .get(`/cliente/${cliente.id}/ventas/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toEqual(200);
                console.log(res.body);

                venta.file_path = res.body[0].file_path;
                expect(res.body[0].total).toEqual(total);
            });*/

            /*test('La factura existe y el nombre coincide', async () => {   
                await delay(300);
                const res = await request('').get(venta.file_path); // El file_path ya tiene el localhost:3001
                expect(res.status).toEqual(200);
            });*/
        });
    });
});
