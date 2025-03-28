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

import {app, server} from '../src/app';
import {conn} from '../src/db'
import {expectBadRequest, expectCreated} from './util';
let token: string;

const venta = {
    medio_pago: '',
    id: null,
    total: 0,
    file_path: '',
    tipo_cbte: 11,
    descuento: 0,
    cliente: 42, // cliente inscripto
    fecha_venta: Date.now(),
    libros: [{
        isbn: '9789784765178',
        cantidad: 3
    },{
        isbn: '9789873397899',
        cantidad: 3
    },{
        isbn: '9789874201096',
        cantidad: 3
    }]
}; 

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

    expect(res.status).toBe(200);
    token = res.body.token;
});

describe('VENTA', () => {
    test('delete ventas', async () => {
        //Buscamos la ultima venta creada
        const t: any = (await conn.query(`
            SELECT id FROM transacciones
            WHERE id_cliente=${venta.cliente}
            ORDER BY id DESC;
        `))[0];

        if (!Array.isArray(venta) || venta.length <= 0 || !('id' in venta[0])){
            return;
        }
        const id = t.id;

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
        test('Agregar stock a los libros', async () => {
            const stock = 6;
            
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

                expectCreated(res);
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
            // Consigno 3 de cada uno
            const consignacion = {
                libros: venta.libros,
                cliente: venta.cliente
            }

            const res = await request(app)
                .post('/consignacion/')
                .set('Authorization', `Bearer ${token}`)
                .send(consignacion);
        
            expectCreated(res);
        });

        test('Actualizar el precio de los libros local', async() => {
            for (const libro of venta.libros){
                const res = await request(app)
                    .put('/libro/'+libro.isbn)
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        precio: 5000
                    });

                expectCreated(res);
            }
        });
    
        test('Actualizar el precio de los libros del cliente', async() => {
            let res = await request(app)
                .put(`/cliente/${venta.cliente}/stock`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            res = await request(app)
                .get(`/cliente/${venta.cliente}/stock`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);

            for (const libro of venta.libros){
                const finded = res.body.find((l: any) => l.isbn == libro.isbn);
                expect(finded).not.toBeNull();
                expect(finded).toHaveProperty('stock');
                expect(finded).toHaveProperty('precio');
                expect(finded.precio).toBe(5000);
            }
        });
    });

    describe('Cargar venta con precio actual', () => {
        describe('Bad request', () => {
            test('Venta no tiene cliente', async () => {
                const ventaSinCliente = Object.assign({}, venta);
                // @ts-expect-error delete the client
                delete ventaSinCliente.cliente;

                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(ventaSinCliente);
                expectBadRequest(res);
            });
            test('Venta no tiene libros', async () => {
                const ventaSinLibros = Object.assign({}, venta);
                // @ts-expect-error delete the client
                delete ventaSinLibros.libros;

                let res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(ventaSinLibros);
                expectBadRequest(res);

                ventaSinLibros.libros = [];

                res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(ventaSinLibros);
                expectBadRequest(res);
            });
            test('Medio de pago incorrecto', async () => {
                venta.medio_pago = 'invalid';
                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expectBadRequest(res);
        
                venta.medio_pago = 'efectivo';
            });
            test('Un libro no tiene suficiente stock', async () => {
                venta.libros[0].cantidad = 5;

                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expectBadRequest(res);

                venta.libros[0].cantidad = 3;
            });
        });

        describe('Venta exitosa', () => {
            test('vender', async () => {
                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(venta);
                expectCreated(res);

                expect(res.body.data).toHaveProperty('file_path');
                venta.id = res.body.data.id;
                venta.file_path = res.body.data.file_path;
                venta.total = res.body.data.total;

                const expected = {
                    id: venta.id,
                    id_cliente: venta.cliente,
                    id_transaccion: venta.id,
                    total: 45000, // 5000 x 3 x 3. 3 titulos con 3 ejemplares cu a 5000 
                    type: 'ventaConsignacion',
                    medio_pago: 'efectivo',
                    tipo_cbte: 11,
                    descuento: 0,
                    //file_path: 'NAZARENONECCHI_2023-07-20_15:37:31.pdf',
                    //fecha: '2023-07-20T18:37:31.000Z',
                    user: 1,
                    libros: [
                        {isbn: '9789784765178', titulo: 'Rio de sueño', cantidad: 3, precio: 5000},
                        {isbn: '9789873397899', titulo:'¿Qué es? ¿Dónde está? Oriato',cantidad: 3, precio: 5000},
                        {isbn: '9789874201096', titulo: 'El Carromato filarmónico',cantidad: 3, precio: 5000},
                    ]
                };


                const res1 = await request(app)
                    .get(`/venta/${venta.id}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res1.status).toBe(200);
                expect(res1.body).toHaveProperty('fecha');
                expect(res1.body).toHaveProperty('file_path');
                expect(res1.body).toMatchObject(expected);
            });

            test('Venta consignacion esta en la lista', async () => {
                const res = await request(app)
                    .get("/venta/")
                    .set('Authorization', `Bearer ${token}`);

                const expected = {
                    id: venta.id,
                    id_transaccion: venta.id,
                    type: "ventaConsignacion",
                    descuento: 0,
                    total: venta.total,
                    tipo_cbte: 11,
                    medio_pago: "efectivo",
                    cuit: "30710712758",
                    nombre_cliente: "nuevo nombre",
                    email: "clientetest@gmail.com",
                    cond_fiscal: " - ",
                    tipo: "inscripto"
                };

                let exists = false;
                for (const v of res.body) {
                    exists = (v.id == venta.id);
                    if (exists) {
                        expect(v).toMatchObject(expected);
                        break;
                    }
                }
                expect(exists).toBe(true);
            });

            test('Los libros del cliente reducieron su stock', async () => {
                const res = await request(app)
                    .get(`/cliente/${venta.cliente}/stock/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toBe(200);

                const expectedStocks = {
                    '9789784765178': 0,
                    '9789873397899': 0,
                    // Este libro ya tiene una consignacion de cantidad 1 con el cliente
                    '9789874201096': 1 
                };

                for (const libro of res.body){
                    if (libro.isbn in expectedStocks) {
                        expect(libro).toHaveProperty('stock');
                        expect(libro.stock).toBe(expectedStocks[libro.isbn as keyof typeof expectedStocks]);
                    }
                }
            });

            test('El total de la venta está bien', async () => {
                let total = 0;

                let res = await request(app)
                    .get(`/cliente/${venta.cliente}/stock/`)
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
                    .get(`/cliente/${venta.cliente}/ventas/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toEqual(200);

                expect(res.body[0].total).toEqual(total);
            });
        });
    });
});
