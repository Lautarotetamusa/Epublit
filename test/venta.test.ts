import {describe, expect, test, vi, beforeAll, afterAll} from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({path: join(__dirname, "../.env")});

// Emitir el comprobante en sí (PDF vía puppeteer) es un detalle de formato
// ajeno a lo que este archivo prueba, se mockea aparte. AFIP no se mockea
// con `vi.mock` (ver createMockAfipService): el container se arma con el
// afip mock directamente, vía DI.
vi.mock('../src/lib/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import {expectBadRequest, expectDataResponse, expectCreated, expectNotFound} from './util';
import { emitirComprobante } from '../src/lib/comprobantes/comprobante';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';

const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

let token: string;
let clienteInscripto: { id: number; tipo: string };
let clienteNegro: { id: number; tipo: string };

// Libros propios (no seedeados) para no interferir con el stock que otros
// archivos de test puedan estar leyendo de los libros del seed.
const isbnsVenta = [isbn(9994), isbn(9993), isbn(9992)];

let venta: any = {};

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

    token = res.body.token;
});

afterAll(() => {
    db.$client.end();
});

describe('VENTA', () => {
    describe('Cargar datos para la venta', () => {
        test('Buscar clientes por defecto (CONSUMIDOR FINAL / MOSTRADOR)', async () => {
            let res = await request(app).get('/cliente?tipo=particular').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            clienteInscripto = res.body.items[0];
            expect(clienteInscripto).toBeDefined();

            res = await request(app).get('/cliente?tipo=negro').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            clienteNegro = res.body.items[0];
            expect(clienteNegro).toBeDefined();
        });

        test('Crear libros con stock para la venta', async () => {
            venta.libros = [];
            for (const isbnLibro of isbnsVenta) {
                const res = await request(app)
                    .post('/libro/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ isbn: isbnLibro, titulo: 'Test venta', fecha_edicion: '2020-01-01', precio: 1000, stock: 3 });

                expectCreated(res);
                venta.libros.push({ isbn: isbnLibro, cantidad: 3 });
            }
        });
    });

    describe('POST /venta', () => {
        describe('Bad request', () => {
            test('Venta no tiene cliente', async () => {
                const { cliente, ...sinCliente } = { ...venta, cliente: clienteInscripto?.id, medio_pago: 'efectivo', tipo_cbte: 11 };

                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(sinCliente);
                expectBadRequest(res);
            });

            test('Venta no tiene libros', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ cliente: clienteInscripto.id, medio_pago: 'efectivo', tipo_cbte: 11, libros: [] });
                expectBadRequest(res);
            });

            test('Medio de pago incorrecto', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ cliente: clienteInscripto.id, medio_pago: 'bitcoin', tipo_cbte: 11, libros: venta.libros });
                expectBadRequest(res);
            });

            test('Un libro no tiene suficiente stock', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: clienteInscripto.id,
                        medio_pago: 'efectivo',
                        tipo_cbte: 11,
                        libros: [{ isbn: isbnsVenta[0], cantidad: 999 }]
                    });
                expectBadRequest(res);
            });
        });

        describe('Venta a un cliente no "negro": factura via AFIP', () => {
            test('vender', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: clienteInscripto.id,
                        medio_pago: 'efectivo',
                        tipo_cbte: 11,
                        libros: [{ isbn: isbnsVenta[0], cantidad: 2 }]
                    });

                expectDataResponse(res, 201);
                expect(res.body.data).toHaveProperty('file_path');
                venta.id = res.body.data.id;

                expect(emitirComprobante).toHaveBeenCalled();
            });

            test('GET venta creada', async () => {
                const res = await request(app)
                    .get(`/venta/${venta.id}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data.type).toEqual('venta');
                expect(res.body.data.libros).toHaveLength(1);
            });

            test('El libro redujo su stock', async () => {
                const res = await request(app)
                    .get(`/libro/${isbnsVenta[0]}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toEqual(200);
                expect(res.body.data.stock).toEqual(1);
            });

            test('GET venta que no existe da 404', async () => {
                const res = await request(app)
                    .get('/venta/999999999')
                    .set('Authorization', `Bearer ${token}`);

                expectNotFound(res);
            });
        });

        describe('Venta a un cliente "negro": no factura', () => {
            test('vender', async () => {
                (emitirComprobante as any).mockClear();

                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: clienteNegro.id,
                        medio_pago: 'efectivo',
                        tipo_cbte: 11,
                        libros: [{ isbn: isbnsVenta[1], cantidad: 1 }]
                    });

                expectDataResponse(res, 201);
                expect(emitirComprobante).not.toHaveBeenCalled();
            });
        });
    });

    describe('GET /venta', () => {
        test('Get all', async () => {
            const res = await request(app)
                .get('/venta/')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);

            const fields = ["id", "type", "descuento", "total", "medio_pago", "tipo_cbte", "id_transaccion",
                "fecha", "file_path", "cuit", "nombre_cliente", "email", "cond_fiscal"];
            for (const v of res.body.data) {
                for (const fieldName of fields) {
                    expect(v).toHaveProperty(fieldName);
                }
                expect(v.type).toEqual('venta');
            }
        });
    });
});
