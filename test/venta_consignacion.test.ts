import {describe, expect, test} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

// Usar la DB de testing
process.env.DB_NAME = "epublit_test";

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

import {app, filesUrl, server} from '../src/app';
import {conn} from '../src/db'
import {delay, expect_err_code, expect_success_code} from './util';
let token: string;

let cliente: any = {}; 
let venta: any = {
    tipo_cbte: 11,
    fecha_venta: Date.now()
}; 
const id_cliente = 42; //Cliente inscripto
let oldLibros: any = [];
let libros: any = [];

afterAll(() => {
    conn.end();
    server.close();
});

it.concurrent('login', async () => {
    const data = {
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
                const aux_cliente = venta.cliente;
                delete venta.cliente;

                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_err_code(400, res);

                venta.cliente = aux_cliente;
            });
            test('Venta no tiene libros', async () => {
                const aux_venta = Object.assign({}, venta.libros);
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
            });
        });

        describe('Venta exitosa', () => {
            test('vender', async () => {
                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expect_success_code(201, res);

                expect(res.body.data).toHaveProperty('file_path');
                venta.id = res.body.data.id;
                venta.file_path = res.body.data.file_path;
                venta.total = res.body.data.total;
                expect(res.body.data.id).toEqual(venta.id);

                const res1 = await request(app)
                    .get(`/venta/${venta.id}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res1.status).toBe(200);

                expect(res1.body.libros).toMatchObject(venta.libros);
                expect(res1.body.type).toEqual("ventaConsignacion");
                expect(res1.body.id_transaccion).toEqual(venta.id);
                expect(res1.body.id_cliente).toEqual(venta.cliente);
            });

            test('La venta consignacion existe', async () => {
                const res = await request(app)
                    .get("/venta/")
                    .set('Authorization', `Bearer ${token}`);

                let exists = false;
                for (const v of res.body) {
                    exists = v.id == venta.id;
                    if (exists) {
                        expect(v.type).toEqual("ventaConsignacion");
                        expect(v.id_transaccion).toEqual(venta.id);
                        expect(v.total).toEqual(venta.total);
                        expect(v.descuento).toEqual(0);
                    }
                }
            });

            test('Los libros del cliente reducieron su stock', async () => {
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
            });

            test('El total de la venta está bien', async () => {
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

                // El cliente tien la venta cargada
                res = await request(app)
                    .get(`/cliente/${cliente.id}/ventas/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toEqual(200);

                expect(res.body[0].total).toEqual(total);
            });
        });
    });
});
