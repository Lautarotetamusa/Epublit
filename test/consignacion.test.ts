import {describe, expect, test} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

jest.mock('../src/comprobantes/comprobante', () => ({
    emitirComprobante: jest.fn().mockResolvedValue(undefined)
}));

process.env.DB_NAME = "epublit_test";
import {app, server} from '../src/app';
import {conn} from '../src/db'
import {expectBadRequest, expectCreated, expectNotFound} from './util';

import { tipoCliente } from '../src/schemas/cliente.schema';
import { RowDataPacket } from 'mysql2';

let token: string;
const cliente = {
    id: 93,
    cuit: "20438409247",
    nombre: "Manuel Krivoy",
    email: "clientetest@gmail.com",
    tipo: tipoCliente.inscripto,
}
const consignacion = {
    libros: [
        { isbn: '11111113', cantidad: 3 },
        { isbn: '11111116', cantidad: 3 },
        { isbn: '192381231', cantidad: 3 }
    ],
    cliente: cliente.id,
}
let idCons: number;

/*
    - Crear un cliente nuevo
    - Seleccionar 3 libros de la pagina 5 de libros /libros?page=5
    - Setear el stock de esos 3 libros en 3
    - Chequear errores de bad request
    - Realizar la consignacion
    - Revisar que los 3 libros tenga ahora stock 0
    - Revisar que la factura haya sido emitida (que exista el archivo)
    - Revisar que el total de la consignacion sea correcto
    - Revisar que el cliente tenga la consignacion en /cliente/{id}/consignacions
*/
afterAll(() => {
    conn.end();
    server.close();
});

test('login', async () => {    
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

describe('CONSIGNACION', () => {
    describe('Cargar datos para la consignacion', () => {
        test('Agregar stock a los libros', async () => {
            const stock = 3;
            
            for (const libro of consignacion.libros) {
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

                expectCreated(res);
            }

            for (const libro of consignacion.libros) {
                const res = await request(app)
                    .get(`/libro/${libro.isbn}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toEqual(200);

                expect(res.body.stock).toEqual(stock);
            }    
        });
    });

    describe('Traer datos', () => {
        test('GET /consignacion', async () => {
            const res = await request(app)
                .get('/consignacion')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);

            const fields = ["id", "id_cliente", "fecha", "file_path", "cuit", "nombre_cliente", "email", "cond_fiscal", "tipo"]
            for (const consignacion of res.body) {
                expect(consignacion).not.toBeNull();
                for (const fieldName of fields) {
                    expect(consignacion).toHaveProperty(fieldName);
                }
            }
        });

        test('GET /consignacion/{id}', async () => {
            const res = await request(app)
                .get('/consignacion/258')
                .set('Authorization', `Bearer ${token}`);

            const expected = {
                id: 258,
                id_cliente: 42,
                type: 'consignacion',
                file_path: 'NAZARENONECCHI_2023-07-20_15:37:31.pdf',
                fecha: '2023-07-20T18:37:31.000Z',
                user: 1,
                libros: [
                    { isbn: '11111112', titulo: 'TEST', cantidad: 3, precio: 0 },
                    { isbn: '11111115', titulo: 'TEST', cantidad: 3, precio: 0 },
                    { isbn: '11111118', titulo: 'TEST', cantidad: 3, precio: 0 }
                ]
            }

            expect(res.status).toBe(200);
            expect(res.body).not.toBeNull();
            expect(res.body).toMatchObject(expected);
        });

        test('Consignacion que no existe debe dar un error', async () => {
            const res = await request(app)
                .get('/consignacion/259')
                .set('Authorization', `Bearer ${token}`);

            expectNotFound(res);
        });
    });

    describe('POST /consignacion', () => {
        describe('Bad request', () => {
            test('Consignacion no tiene cliente', async () => {
                const req = {libros: consignacion.libros};

                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(req);
                expectBadRequest(res);
            });

            test('Un libro no tiene suficiente stock', async () => {
                consignacion.libros[2].cantidad = 5;

                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(consignacion);
                expectBadRequest(res);

                consignacion.libros[2].cantidad = 3;
            });

            test('No se debe poder consignar a un cliente consumidor final', async () => {
                const res1 = await request(app)
                    .get('/cliente/consumidor_final')
                    .set('Authorization', `Bearer ${token}`);

                expect(res1.status).toEqual(200);
                const consumidor_final = res1.body;

                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        ...consignacion,
                        cliente: consumidor_final.id
                    });

                expectBadRequest(res);
            });
        });

        describe('consignacion exitosa', () => {
            test('Consignar', async () => {
                const res = await request(app)
                    .post('/consignacion/')
                    .set('Authorization', `Bearer ${token}`)
                    .send(consignacion);
            
                expectCreated(res);
                idCons = res.body.data.id;
            });

            test('La consignacion debe estar bien cargada', async () => {
                const res = await request(app)
                    .get(`/consignacion/${idCons}`)
                    .set('Authorization', `Bearer ${token}`)

                const expected = {
                    id: idCons,
                    id_cliente: 93,
                    type: 'consignacion',
                    // I cant make the jest set system time to work with this, but its tested in cliente.test
                    //file_path: 'MANUELKRIVOY-20250308-175356.pdf',
                    //fecha: '2025-03-08T17:53:56.938Z',
                    user: 1,
                    libros: [
                        { isbn: '11111113', titulo: 'TEST', cantidad: 3, precio: 2500 },
                        { isbn: '11111116', titulo: 'TEST', cantidad: 3, precio: 51 },
                        { isbn: '192381231', titulo: 'hola', cantidad: 3, precio: 0 }
                    ]
                }

                expect(res.status).toBe(200);
                expect(res.body).toMatchObject(expected);
            });

            test('Los libros reducieron su stock', async () => {
                for (const libro of consignacion.libros) {
                    const res = await request(app)
                        .get(`/libro/${libro.isbn}`)
                        .set('Authorization', `Bearer ${token}`);
        
                    expect(res.status).toEqual(200);
                    expect(res.body.stock).toEqual(0);
                }
            });

            test('El cliente tiene el stock cargado', async () => {
                const res = await request(app)
                    .get(`/cliente/${cliente.id}/stock/`)
                    .set('Authorization', `Bearer ${token}`);
                expect(res.status).toEqual(200);

                for (const libro of res.body) {
                    expect(libro.stock).toEqual(3);
                }
            });

            test('Se carga un registro en precio_libro_cliente por cada libro', async () => {
                const [rows] = await conn.query<RowDataPacket[]>(`
                    SELECT id_libro, precio FROM precio_libro_cliente
                    WHERE id_cliente = ?`, [cliente.id]);

                const expectedRows = [
                    {id_libro: 6, precio: 2500 },
                    {id_libro: 8, precio: 51 },
                    {id_libro: 11, precio: 0 }
                ];
                expect(rows).toMatchObject(expectedRows);
            });
        });
    });
});
