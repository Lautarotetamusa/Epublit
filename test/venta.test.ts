import {describe, expect, test, vi} from 'vitest';
import request from "supertest";
import { inArray } from 'drizzle-orm';

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
import {app, filesUrl, server} from '../src/app';
import {conn} from '../src/db'
import { db } from '../src/pgDb';
import { librosTable } from '../src/schemas/libros.schema';
import {expectBadRequest, expectDataResponse, expectCreated, expectNotFound} from './util';
import { emitirComprobante } from '../src/comprobantes/comprobante';

let token: string;
let clienteInscripto: { id: number; tipo: string };
let clienteNegro: { id: number; tipo: string };

// No se migran datos históricos (spec, "Fuera de alcance"): a diferencia del
// test legado (que asumía ids de MySQL ya cargados), este test crea sus
// propios libros/clientes contra Postgres.
const isbnsVenta = ["9000000000001", "9000000000002", "9000000000003"];

let venta: any = {};

afterAll(async () => {
    await db.delete(librosTable).where(inArray(librosTable.isbn, isbnsVenta));
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

describe('VENTA', () => {
    describe('Cargar datos para la venta', () => {
        test('Buscar clientes por defecto (CONSUMIDOR FINAL / MOSTRADOR)', async () => {
            let res = await request(app).get('/cliente?tipo=particular').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            clienteInscripto = res.body[0];
            expect(clienteInscripto).toBeDefined();

            res = await request(app).get('/cliente?tipo=negro').set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            clienteNegro = res.body[0];
            expect(clienteNegro).toBeDefined();
        });

        test('Crear libros con stock para la venta', async () => {
            venta.libros = [];
            for (const isbn of isbnsVenta) {
                const res = await request(app)
                    .post('/libro/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ isbn, titulo: 'Test venta', fecha_edicion: '2020-01-01', precio: 1000, stock: 3 });

                expectCreated(res);
                venta.libros.push({ isbn, cantidad: 3 });
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
                expect(res.body.type).toEqual('venta');
                expect(res.body.libros).toHaveLength(1);
            });

            test('El libro redujo su stock', async () => {
                const res = await request(app)
                    .get(`/libro/${isbnsVenta[0]}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toEqual(200);
                expect(res.body.stock).toEqual(1);
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
            for (const v of res.body) {
                for (const fieldName of fields) {
                    expect(v).toHaveProperty(fieldName);
                }
                expect(v.type).toEqual('venta');
            }
        });
    });
});
