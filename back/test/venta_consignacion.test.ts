import {describe, expect, test, vi, beforeAll, afterAll} from 'vitest';
import request from "supertest";
import { inArray } from 'drizzle-orm';

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({path: join(__dirname, "../.env")});

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { librosTable } from '../src/modules/libro/libro.schema';
import { libroClienteTable } from '../src/modules/cliente/libroCliente.schema';
import { precioLibroClienteTable } from '../src/modules/cliente/precioLibroCliente.schema';
import {expectBadRequest, delay} from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';

const comprobanteService = createMockComprobanteService({ emitirComprobante: vi.fn().mockResolvedValue(undefined) });
const container = createContainer({ afipService: createMockAfipService(), comprobanteService });
const app = createApp(container);

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
afterAll(() => {
    db.$client.end();
});

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

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

            // `getStockAFecha` le suma 3hs a la fecha recibida para interpretarla
            // como GMT-3 (ver clienteStock.repository.ts): para que "ahora
            // mismo" siga cayendo antes de la sincronización de más abajo, hay
            // que restar esas 3hs acá.
            fechaHistorica = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
            await delay(1200); // asegurar timestamps distintos entre precio histórico y precio actual
        });

        test('Actualizar precio de los libros y sincronizar', async () => {
            for (const isbn of isbnsVentaConsig) {
                const res = await request(app)
                    .put(`/libro/${isbn}`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ precio: precioActual });
                expect(res.status).toBe(200);
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
                const negro = res1.body.items[0];

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
                expect(comprobanteService.emitirComprobante).toHaveBeenCalled();
            });

            test('Se redujo el stock del cliente, no el stock general del libro', async () => {
                const resStock = await request(app)
                    .get(`/cliente/${cliente.id}/stock`)
                    .set('Authorization', `Bearer ${token}`);

                const libroCliente = resStock.body.data.find((l: any) => l.isbn === isbnsVentaConsig[0]);
                expect(libroCliente.stock).toEqual(stockCliente - 2);

                const resLibro = await request(app)
                    .get(`/libro/${isbnsVentaConsig[0]}`)
                    .set('Authorization', `Bearer ${token}`);
                expect(resLibro.body.data.stock).toEqual(0);
            });
        });
    });
});
