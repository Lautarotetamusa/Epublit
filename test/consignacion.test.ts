import {describe, expect, test, vi, beforeAll, afterAll} from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

vi.mock('../src/lib/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { env } from '../src/env';
import {expectBadRequest, expectCreated, expectNotFound} from './util';
import { emitirComprobante } from '../src/lib/comprobantes/comprobante';
import { PASSWORD_SEED } from '../seeders/users.seeder';

const afipService = createMockAfipService({
    getAfipData: async () => ({
        ingresos_brutos: false,
        fecha_inicio: "10/02/2025",
        razon_social: "CLIENTE CONSIGNACION",
        cond_fiscal: "IVA EXENTO",
        domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
    })
});
const container = createContainer({ afipService });
const app = createApp(container);

let token: string;
const cuit = "20438409248";
const isbnsConsignacion = ["9100000000001", "9100000000002", "9100000000003"];

let cliente: any = {};
const consignacion: any = { libros: [] };

afterAll(() => {
    db.$client.end();
});

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

    token = res.body.token;
});

describe('CONSIGNACION', () => {
    describe('Cargar datos para la consignacion', () => {
        test('Crear cliente inscripto', async () => {
            const res = await request(app)
                .post('/cliente/')
                .set('Authorization', `Bearer ${token}`)
                .send({ nombre: 'Cliente consignacion', email: 'consignacion@test.com', cuit });

            expectCreated(res);
            cliente = res.body.data;
            consignacion.cliente = cliente.id;
        });

        test('Crear libros con stock', async () => {
            for (const isbn of isbnsConsignacion) {
                const res = await request(app)
                    .post('/libro/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ isbn, titulo: 'Test consignacion', fecha_edicion: '2020-01-01', precio: 500, stock: 3 });

                expectCreated(res);
                consignacion.libros.push({ isbn, cantidad: 3 });
            }
        });
    });

    describe('POST /consignacion', () => {
        describe('Bad request', () => {
            test('Consignacion no tiene cliente', async () => {
                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ libros: consignacion.libros });
                expectBadRequest(res);
            });

            test('Un libro no tiene suficiente stock', async () => {
                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ cliente: cliente.id, libros: [{ isbn: isbnsConsignacion[0], cantidad: 999 }] });
                expectBadRequest(res);
            });

            test('No se debe poder consignar a un cliente consumidor final', async () => {
                const res1 = await request(app)
                    .get('/cliente?tipo=particular')
                    .set('Authorization', `Bearer ${token}`);
                expect(res1.status).toEqual(200);
                const consumidorFinal = res1.body.items[0];

                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ ...consignacion, cliente: consumidorFinal.id });

                expectBadRequest(res);
            });
        });

        describe('consignacion exitosa', () => {
            let idConsignacion: number;

            test('Consignar', async () => {
                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(consignacion);

                expect(res.status).toBe(201);
                expect(res.body.success).toBe(true);
                idConsignacion = res.body.data.id;
                expect(emitirComprobante).toHaveBeenCalled();
            });

            test('Los libros redujeron su stock general', async () => {
                for (const libro of consignacion.libros) {
                    const res = await request(app)
                        .get(`/libro/${libro.isbn}`)
                        .set('Authorization', `Bearer ${token}`);

                    expect(res.status).toEqual(200);
                    expect(res.body.data.stock).toEqual(0);
                }
            });

            test('El cliente tiene los libros en su stock', async () => {
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/stock`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toEqual(200);
                for (const libro of consignacion.libros) {
                    const enStock = res.body.data.find((l: any) => l.isbn === libro.isbn);
                    expect(enStock).toBeDefined();
                    expect(enStock.stock).toEqual(libro.cantidad);
                }
            });

            test('GET /consignacion/{id}', async () => {
                const res = await request(app)
                    .get(`/consignacion/${idConsignacion}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data.id_cliente).toEqual(cliente.id);
                expect(res.body.data.file_path).toContain(env.HOST);
                expect(res.body.data.libros).toHaveLength(consignacion.libros.length);
            });

            test('Consignacion que no existe debe dar un error', async () => {
                const res = await request(app)
                    .get('/consignacion/999999999')
                    .set('Authorization', `Bearer ${token}`);

                expectNotFound(res);
            });

            test('GET /consignacion lista la consignacion propia', async () => {
                const res = await request(app)
                    .get('/consignacion')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data.map((c: any) => c.id)).toContain(idConsignacion);
            });
        });
    });
});
