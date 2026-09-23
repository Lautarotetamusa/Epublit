import {describe, expect, test, vi} from 'vitest';
import request from "supertest";
import { eq, inArray } from 'drizzle-orm';

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

vi.mock('../src/afip/afip.js/src/Class/ElectronicBilling', () => {
    return vi.fn().mockImplementation(() => ({
        createNextVoucher: vi.fn().mockResolvedValue({
          CAE: '123456789',
          CAEFchVto: '20250201',
          voucherNumber: "1001",
        }),
        getVoucherInfo: vi.fn().mockResolvedValue({
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
vi.mock('../src/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

// Usar la DB de testing
process.env.DB_NAME = "epublit_test";

import {app, server} from '../src/app';
import {conn} from '../src/db'
import { db } from '../src/pgDb';
import { librosTable } from '../src/schemas/libros.schema';
import { clientesTable } from '../src/schemas/clientes.schema';
import { libroClienteTable } from '../src/schemas/libroCliente.schema';
import { precioLibroClienteTable } from '../src/schemas/precioLibroCliente.schema';
import {expectBadRequest, delay} from './util';
import { emitirComprobante } from '../src/comprobantes/comprobante';

let token: string;
const cuit = "20438409249";
const isbnsVentaConsig = ["9200000000001", "9200000000002"];
const precioHistorico = 1000;
const precioActual = 2000;
const stockCliente = 5;

let cliente: any = {};
let fechaHistorica: string;

/*
    - Crear un cliente inscripto nuevo
    - Crear 2 libros, precargar libro_cliente con precio historico y stock
    - Actualizar el precio de los libros y sincronizar (nuevo precio_libro_cliente)
    - Vender en consignacion usando la fecha historica: precio historico, stock actual
    - El stock del cliente se reduce; el stock general del libro no se toca
*/
afterAll(async () => {
    if (cliente.id) {
        await db.delete(precioLibroClienteTable).where(eq(precioLibroClienteTable.id_cliente, cliente.id));
        await db.delete(libroClienteTable).where(eq(libroClienteTable.id_cliente, cliente.id));
        await db.delete(clientesTable).where(eq(clientesTable.id, cliente.id));
    }
    await db.delete(librosTable).where(inArray(librosTable.isbn, isbnsVentaConsig));
    conn.end();
    server.close();
});

test('login', async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'teti', password: 'Lautaro123.' });

    expect(res.status).toBe(200);
    token = res.body.token;
});

describe('VENTA EN CONSIGNACION', () => {
    describe('Cargar datos', () => {
        test('Crear cliente inscripto', async () => {
            const res = await request(app)
                .post('/cliente/')
                .set('Authorization', `Bearer ${token}`)
                .send({ nombre: 'Cliente venta consignacion', email: 'ventaconsig@test.com', cuit });

            expect(res.status).toBe(201);
            cliente = res.body.data;
        });

        test('Crear libros', async () => {
            for (const isbn of isbnsVentaConsig) {
                const res = await request(app)
                    .post('/libro/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ isbn, titulo: 'Test venta consignacion', fecha_edicion: '2020-01-01', precio: precioHistorico, stock: 0 });

                expect(res.status).toBe(201);
            }
        });

        test('Cargar stock/precio histórico del cliente directo en Postgres', async () => {
            const libros = await db.select().from(librosTable).where(inArray(librosTable.isbn, isbnsVentaConsig));

            for (const libro of libros) {
                await db.insert(libroClienteTable).values({
                    id_cliente: cliente.id,
                    id_libro: libro.id_libro,
                    isbn: libro.isbn,
                    stock: stockCliente,
                    precio: precioHistorico
                });
                await db.insert(precioLibroClienteTable).values({
                    id_cliente: cliente.id,
                    id_libro: libro.id_libro,
                    precio: precioHistorico
                });
            }

            fechaHistorica = new Date().toISOString();
            await delay(1200); // asegurar timestamps distintos entre precio histórico y precio actual
        });

        test('Actualizar precio de los libros y sincronizar', async () => {
            for (const isbn of isbnsVentaConsig) {
                const res = await request(app)
                    .put(`/libro/${isbn}`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ precio: precioActual });
                expect(res.status).toBe(201);
            }

            const res = await request(app)
                .put(`/cliente/${cliente.id}/stock`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });

    describe('POST /ventaConsignacion', () => {
        describe('Bad request', () => {
            test('Cliente no inscripto', async () => {
                const res1 = await request(app).get('/cliente?tipo=negro').set('Authorization', `Bearer ${token}`);
                const negro = res1.body[0];

                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: negro.id,
                        libros: [{ isbn: isbnsVentaConsig[0], cantidad: 1 }],
                        fecha_venta: fechaHistorica,
                        medio_pago: 'efectivo',
                        tipo_cbte: 11
                    });

                expectBadRequest(res);
            });

            test('Sin stock suficiente en el cliente', async () => {
                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: cliente.id,
                        libros: [{ isbn: isbnsVentaConsig[0], cantidad: 999 }],
                        fecha_venta: fechaHistorica,
                        medio_pago: 'efectivo',
                        tipo_cbte: 11
                    });

                expectBadRequest(res);
            });
        });

        describe('Venta en consignacion exitosa (precio histórico)', () => {
            test('vender', async () => {
                const cantidad = 2;
                const res = await request(app)
                    .post('/ventaConsignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: cliente.id,
                        libros: [{ isbn: isbnsVentaConsig[0], cantidad }],
                        fecha_venta: fechaHistorica,
                        medio_pago: 'efectivo',
                        tipo_cbte: 11
                    });

                expect(res.status).toBe(201);
                // Precio histórico (1000), no el actual (2000).
                expect(res.body.data.total).toEqual(precioHistorico * cantidad);
                expect(emitirComprobante).toHaveBeenCalled();
            });

            test('Se redujo el stock del cliente, no el stock general del libro', async () => {
                const resStock = await request(app)
                    .get(`/cliente/${cliente.id}/stock`)
                    .set('Authorization', `Bearer ${token}`);

                const libroCliente = resStock.body.find((l: any) => l.isbn === isbnsVentaConsig[0]);
                expect(libroCliente.stock).toEqual(stockCliente - 2);

                const resLibro = await request(app)
                    .get(`/libro/${isbnsVentaConsig[0]}`)
                    .set('Authorization', `Bearer ${token}`);
                expect(resLibro.body.stock).toEqual(0);
            });
        });
    });
});
