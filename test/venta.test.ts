import {describe, expect, test} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

jest.mock('../src/afip/afip.js/src/Class/ElectronicBilling', () => {
    return jest.fn().mockImplementation(() => ({
        createNextVoucher: jest.fn().mockResolvedValue({
          CAE: '123456789',
          CAEFchVto: '20250201',
          voucherNumber: "1001",
        }),
        getVoucherInfo: jest.fn().mockResolvedValue({
            nro: "1001",
            qr: "",
            CbteTipo: "1",
            PtoVta: "1",
            CodAutorizacion: "qwert12345",
            FchVto: "20250222",
            CbteFch: "20250222",
      })
    }))
});
jest.mock('../src/comprobantes/comprobante', () => ({
    emitirComprobante: jest.fn().mockResolvedValue(undefined)
}));

// Usar la DB de testing
process.env.DB_NAME = "epublit_test";
import {app, server} from '../src/app';
import {conn} from '../src/db'
import {expect_err_code, expect_success_code} from './util';

let token: string;

let cliente: any = {}; 
let venta: any = {}; 
const id_cliente = 1;

/*
    - Crear un cliente nuevo
    - Seleccionar 3 libros de la pagina 5 de libros /libros?page=5
    - Setear el stock de esos 3 libros en 3
    - Chequear errores de bad request
    - Realizar la venta
    - Revisar que los 3 libros tenga ahora stock 0
    - Revisar que la factura haya sido emitida (que exista el archivo)
    - Revisar que el total de la venta sea correcto
    - Revisar que el cliente tenga la venta en /cliente/{id}/ventas
*/

afterAll(() => {
    conn.end();
    server.close();
});

test('login', async () => {
    let data = {
        username: 'teti',
        password: 'Lautaro123.'
    }
    const res = await request(app)
        .post('/user/login')
        .send(data);

    expect_success_code(200, res);
    token = res.body.token;
});

describe('VENTA', () => {
    test('delete ventas', async () => {
        //Buscamos la ultima venta creada
        const res: any = await conn.query(`
            SELECT id FROM transacciones
            WHERE id_cliente=${id_cliente}
            ORDER BY id DESC;
        `);
        const venta = res[0];

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
            expect(res.body.length).toBeGreaterThan(0);
            venta['libros'] = [ res.body[3], res.body[5], res.body[8] ];
        });

        test('Agregar stock a los libros', async () => {
            let stock = 3;
            
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

                libro.cantidad = stock;

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
    });

    describe('POST /venta', () => {
        describe('Bad request', () => {
            test('Venta no tiene cliente', async () => {
                let aux_cliente = venta.cliente;
                delete venta.cliente;

                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);

                venta.cliente = aux_cliente;
            });
            test('Venta no tiene libros', async () => {
                let aux_venta = Object.assign({}, venta.libros);
                delete aux_venta.libros;

                let res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(aux_venta);
                expect_err_code(400, res);

                aux_venta.libros = [];

                res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(aux_venta);
                expect_err_code(400, res);
            });
            test('Medio de pago incorrecto', async () => {
                venta.medio_pago = '';
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);
        
                venta.medio_pago = 'efectivo';
            });
            test('Un libro no tiene suficiente stock', async () => {
                venta.libros[2].cantidad = 5;

                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);

                venta.libros[2].cantidad = 3;
            });
        });

        describe('Venta exitosa', () => {
            test('vender', async () => {
                venta.tipo_cbte = 11;
                let res: any = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);

                expect_success_code(201, res);

                expect(res.body.data).toHaveProperty('file_path');
                venta.id = res.body.data.id;
                venta.file_path = res.body.data.file_path;
                expect(res.body.data.id).toEqual(venta.id);

                res = await request(app)
                    .get(`/venta/${venta.id}`)
                    .set('Authorization', `Bearer ${token}`)
                expect(res.status).toBe(200);
                expect(res.body.type).toEqual("venta");
            });

            test('Los libros reducieron su stock', async () => {
                //console.log("VENTA:", venta);
                let total = 0;
                for (const libro of venta.libros) {
                    const res = await request(app)
                        .get(`/libro/${libro.isbn}`)
                        .set('Authorization', `Bearer ${token}`);

                    total += libro.cantidad * res.body.precio;
                    total -= total * (venta.descuento ?? 0) * 0.01;
                    total = parseFloat(total.toFixed(2));
        
                    expect(res.status).toEqual(200);
                    expect(res.body.stock).toEqual(0);
                }
                venta.total = total;
            });

            test('El cliente tiene la venta cargada', async () => {
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/ventas/`)
                    .set('Authorization', `Bearer ${token}`);
            
                expect(res.status).toEqual(200);
                expect(res.body[0]).not.toBeNull;
                expect(res.body[0].id).toEqual(venta.id);
            });

            test('El total de la venta está bien', async () => {
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/ventas/`)
                    .set('Authorization', `Bearer ${token}`);

                venta.file_path = res.body[0].file_path;
            
                expect(res.status).toEqual(200);
                expect(res.body[0].total).toEqual(venta.total);
            });
        });
    });
});
