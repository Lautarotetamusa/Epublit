import {describe, expect, test, vi} from 'vitest';
import request from "supertest";
import { eq, inArray } from 'drizzle-orm';

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

const cuitNoExistente = "12345";

vi.mock('../src/afip/Afip', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/afip/Afip')>();
    return {
        ...actual,
        getAfipData: vi.fn().mockResolvedValue({
            ingresos_brutos: false,
            fecha_inicio: "10/02/2025",
            razon_social: "CLIENTE CONSIGNACION",
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        })
    };
});
vi.mock('../src/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

process.env.DB_NAME = "epublit_test";
import {app, filesUrl, server} from '../src/app';
import {conn} from '../src/db'
import { db } from '../src/pgDb';
import { librosTable } from '../src/schemas/libros.schema';
import { clientesTable } from '../src/schemas/clientes.schema';
import { libroClienteTable } from '../src/schemas/libroCliente.schema';
import { precioLibroClienteTable } from '../src/schemas/precioLibroCliente.schema';
import {expectBadRequest, expectCreated, expectNotFound} from './util';
import { emitirComprobante } from '../src/comprobantes/comprobante';

let token: string;
const cuit = "20438409248";
const isbnsConsignacion = ["9100000000001", "9100000000002", "9100000000003"];

let cliente: any = {};
const consignacion: any = { libros: [] };

/*
    - Crear un cliente inscripto nuevo
    - Crear 3 libros con stock 3
    - Chequear errores de bad request
    - Realizar la consignacion
    - Revisar que los 3 libros tengan ahora stock 0 (stock general)
    - Revisar que el cliente tenga esos 3 libros en su stock (libro_cliente)
    - Revisar que se haya emitido el remito
*/
afterAll(async () => {
    if (cliente.id) {
        await db.delete(precioLibroClienteTable).where(eq(precioLibroClienteTable.id_cliente, cliente.id));
        await db.delete(libroClienteTable).where(eq(libroClienteTable.id_cliente, cliente.id));
        await db.delete(clientesTable).where(eq(clientesTable.id, cliente.id));
    }
    await db.delete(librosTable).where(inArray(librosTable.isbn, isbnsConsignacion));
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
                const consumidorFinal = res1.body[0];

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
                    expect(res.body.stock).toEqual(0);
                }
            });

            test('El cliente tiene los libros en su stock', async () => {
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/stock`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toEqual(200);
                for (const libro of consignacion.libros) {
                    const enStock = res.body.find((l: any) => l.isbn === libro.isbn);
                    expect(enStock).toBeDefined();
                    expect(enStock.stock).toEqual(libro.cantidad);
                }
            });

            test('GET /consignacion/{id}', async () => {
                const res = await request(app)
                    .get(`/consignacion/${idConsignacion}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.id_cliente).toEqual(cliente.id);
                expect(res.body.file_path).toContain(filesUrl);
                expect(res.body.libros).toHaveLength(consignacion.libros.length);
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
                expect(res.body.map((c: any) => c.id)).toContain(idConsignacion);
            });
        });
    });
});
