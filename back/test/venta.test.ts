import {describe, expect, test, vi, beforeAll, afterAll} from 'vitest';
import request from "supertest";
import { eq } from 'drizzle-orm';

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({path: join(__dirname, "../.env")});

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { transaccionesTable } from '../src/modules/transaccion/transaccion.schema';
import { libroClienteTable } from '../src/modules/cliente/libroCliente.schema';
import { precioLibroClienteTable } from '../src/modules/cliente/precioLibroCliente.schema';
import { librosTable } from '../src/modules/libro/libro.schema';
import {expectBadRequest, expectDataResponse, expectCreated, expectNotFound} from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';

// Emitir el comprobante en sí (PDF vía puppeteer) es un detalle de formato
// ajeno a lo que este archivo prueba, se mockea vía DI en vez de `vi.mock`
// (mismo criterio que `createMockAfipService`, ver
// `lib/comprobantes/comprobante.mock.ts`).
const comprobanteService = createMockComprobanteService({ emitirComprobante: vi.fn().mockResolvedValue(undefined) });
const container = createContainer({ afipService: createMockAfipService(), comprobanteService });
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

                expect(comprobanteService.emitirComprobante).toHaveBeenCalled();
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
                (comprobanteService.emitirComprobante as any).mockClear();

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
                expect(comprobanteService.emitirComprobante).not.toHaveBeenCalled();
            });
        });
    });

    describe('GET /venta', () => {
        test('Get all', async () => {
            // `pageSize` alto para traer todo lo creado hasta acá en este
            // archivo (paginación por default trae sólo 10, ver "filtros y
            // paginación" más abajo).
            const res = await request(app)
                .get('/venta?pageSize=100')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ success: true, page: 1, pageSize: 100 });
            expect(res.body.total).toBeGreaterThanOrEqual(res.body.data.length);

            const fields = ["id", "type", "descuento", "total", "medio_pago", "tipo_cbte", "id_transaccion",
                "fecha", "file_path", "cuit", "nombre_cliente", "email", "cond_fiscal"];
            for (const v of res.body.data) {
                for (const fieldName of fields) {
                    expect(v).toHaveProperty(fieldName);
                }
                // Sin `tipo` en la query, GET /venta trae los dos tipos de
                // venta (ver venta.repository.ts#getAll): antes sólo traía
                // "venta", aunque el front (VentasPage.tsx) ya esperaba los
                // dos en la misma columna "Tipo".
                expect(['venta', 'ventaConsignacion']).toContain(v.type);
            }
        });
    });

    describe('GET /venta - filtros y paginación', () => {
        const isbnsFiltro = [isbn(9979), isbn(9978)];
        const cuitFiltro = '20438409251';
        const cuitOtroUsuario = '20438409252';

        let clienteFiltro: { id: number };
        let ventaEfectivoId: number;
        let ventaTransferenciaId: number;
        let ventaConsigId: number;

        const setFecha = async (idTransaccion: number, fecha: string) => {
            await db.update(transaccionesTable).set({ fecha: new Date(fecha) }).where(eq(transaccionesTable.id, idTransaccion));
        };

        beforeAll(async () => {
            // Cliente propio para este bloque: aísla el total/paginación del
            // resto de ventas que pueda haber para este mismo usuario (misma
            // DB compartida entre archivos de test, ver vitest.config.ts).
            const resCliente = await request(app)
                .post('/cliente/')
                .set('Authorization', `Bearer ${token}`)
                .send({ nombre: 'Cliente filtro ventas', email: 'filtroventas@test.com', cuit: cuitFiltro });
            expectCreated(resCliente);
            clienteFiltro = resCliente.body.data;

            for (const isbnLibro of isbnsFiltro) {
                const res = await request(app)
                    .post('/libro/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ isbn: isbnLibro, titulo: 'Test filtro ventas', fecha_edicion: '2020-01-01', precio: 500, stock: 10 });
                expectCreated(res);
            }

            let res = await request(app)
                .post('/venta/')
                .set('Authorization', `Bearer ${token}`)
                .send({ cliente: clienteFiltro.id, medio_pago: 'efectivo', tipo_cbte: 11, libros: [{ isbn: isbnsFiltro[0], cantidad: 1 }] });
            expectCreated(res);
            ventaEfectivoId = res.body.data.id;
            await setFecha(ventaEfectivoId, '2024-01-10');

            res = await request(app)
                .post('/venta/')
                .set('Authorization', `Bearer ${token}`)
                .send({ cliente: clienteFiltro.id, medio_pago: 'transferencia', tipo_cbte: 11, libros: [{ isbn: isbnsFiltro[0], cantidad: 1 }] });
            expectCreated(res);
            ventaTransferenciaId = res.body.data.id;
            await setFecha(ventaTransferenciaId, '2024-02-10');

            // Venta sobre consignado: precarga directa de stock/precio del
            // cliente (mismo mecanismo que venta_consignacion.test.ts, acá
            // sin precio histórico porque no hace falta para estos tests).
            const [libroConsig] = await db.select().from(librosTable).where(eq(librosTable.isbn, isbnsFiltro[1]));
            await db.insert(libroClienteTable).values({
                id_cliente: clienteFiltro.id,
                id_libro: libroConsig.id_libro,
                isbn: libroConsig.isbn,
                stock: 5,
                precio: 500
            });
            await db.insert(precioLibroClienteTable).values({
                id_cliente: clienteFiltro.id,
                id_libro: libroConsig.id_libro,
                precio: 500
            });

            res = await request(app)
                .post('/ventaConsignacion/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    cliente: clienteFiltro.id,
                    libros: [{ isbn: isbnsFiltro[1], cantidad: 1 }],
                    fecha_venta: new Date().toISOString(),
                    medio_pago: 'efectivo',
                    tipo_cbte: 11
                });
            expectCreated(res);
            ventaConsigId = res.body.data.id;
            await setFecha(ventaConsigId, '2024-03-10');
        });

        describe('Filtro por cliente', () => {
            test('sólo trae las ventas de ese cliente', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.total).toEqual(3);
                expect(res.body.data).toHaveLength(3);
                for (const v of res.body.data) expect(v.id_cliente).toEqual(clienteFiltro.id);
            });

            test('cliente de otro usuario: 200 con lista vacía', async () => {
                const loginOtro = await request(app)
                    .post('/user/login')
                    .send({ username: 'editorial_norte', password: PASSWORD_SEED });
                const clientesOtro = await request(app)
                    .get('/cliente')
                    .set('Authorization', `Bearer ${loginOtro.body.token}`);
                const clienteOtroUsuario = clientesOtro.body.items[0];

                const res = await request(app)
                    .get(`/venta?cliente=${clienteOtroUsuario.id}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(0);
                expect(res.body.total).toEqual(0);
            });

            test('cliente inexistente: 200 con lista vacía', async () => {
                const res = await request(app)
                    .get('/venta?cliente=999999999')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(0);
                expect(res.body.total).toEqual(0);
            });
        });

        describe('Filtro por tipo', () => {
            test('tipo=venta trae sólo ventas en firme', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&tipo=venta`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(2);
                for (const v of res.body.data) expect(v.type).toEqual('venta');
            });

            test('tipo=ventaConsignacion trae sólo ventas sobre consignado', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&tipo=ventaConsignacion`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(1);
                expect(res.body.data[0].id).toEqual(ventaConsigId);
            });

            test('tipo inválido: 400', async () => {
                const res = await request(app)
                    .get('/venta?tipo=consignacion')
                    .set('Authorization', `Bearer ${token}`);

                expectBadRequest(res);
            });
        });

        describe('Filtro por medio de pago', () => {
            test('medioPago válido trae sólo ese medio de pago', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&medioPago=transferencia`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(1);
                expect(res.body.data[0].id).toEqual(ventaTransferenciaId);
            });

            test('medioPago inválido: 400', async () => {
                const res = await request(app)
                    .get('/venta?medioPago=bitcoin')
                    .set('Authorization', `Bearer ${token}`);

                expectBadRequest(res);
            });
        });

        describe('Filtro por rango de fechas', () => {
            test('desde: fecha mayor o igual', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&desde=2024-02-01`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data.map((v: any) => v.id).sort()).toEqual([ventaTransferenciaId, ventaConsigId].sort());
            });

            test('hasta: fecha menor o igual', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&hasta=2024-02-15`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data.map((v: any) => v.id).sort()).toEqual([ventaEfectivoId, ventaTransferenciaId].sort());
            });

            test('desde + hasta: rango inclusive', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&desde=2024-01-01&hasta=2024-01-31`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(1);
                expect(res.body.data[0].id).toEqual(ventaEfectivoId);
            });

            test('desde posterior a hasta: 400', async () => {
                const res = await request(app)
                    .get('/venta?desde=2024-05-01&hasta=2024-01-01')
                    .set('Authorization', `Bearer ${token}`);

                expectBadRequest(res);
            });

            test('desde inválida: 400', async () => {
                const res = await request(app)
                    .get('/venta?desde=no-es-una-fecha')
                    .set('Authorization', `Bearer ${token}`);

                expectBadRequest(res);
            });
        });

        describe('Combinar filtros', () => {
            test('cliente + tipo + medioPago combinados con AND', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&tipo=venta&medioPago=efectivo`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(1);
                expect(res.body.data[0].id).toEqual(ventaEfectivoId);
            });

            test('combo que no matchea ninguna venta: 200 con lista vacía', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&tipo=ventaConsignacion&medioPago=transferencia`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(0);
                expect(res.body.total).toEqual(0);
            });
        });

        describe('Paginación', () => {
            test('sin page/pageSize: primera página con tamaño por default', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.page).toEqual(1);
                expect(res.body.pageSize).toBeGreaterThan(0);
                expect(res.body.total).toEqual(3);
                expect(res.body.data).toHaveLength(3);
            });

            test('page=2 trae el segundo bloque sin solapar con la página 1', async () => {
                const res1 = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&page=1&pageSize=2`)
                    .set('Authorization', `Bearer ${token}`);
                const res2 = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&page=2&pageSize=2`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res1.body.data).toHaveLength(2);
                expect(res2.body.data).toHaveLength(1);
                expect(res2.body.total).toEqual(3);

                const idsPagina1 = res1.body.data.map((v: any) => v.id);
                const idsPagina2 = res2.body.data.map((v: any) => v.id);
                expect(idsPagina1.some((id: number) => idsPagina2.includes(id))).toBe(false);
            });

            test('página fuera de rango: 200 con data vacío', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&page=99&pageSize=2`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(0);
                expect(res.body.total).toEqual(3);
            });

            test('page=0: 400', async () => {
                const res = await request(app)
                    .get('/venta?page=0')
                    .set('Authorization', `Bearer ${token}`);

                expectBadRequest(res);
            });

            test('pageSize=0: 400', async () => {
                const res = await request(app)
                    .get('/venta?pageSize=0')
                    .set('Authorization', `Bearer ${token}`);

                expectBadRequest(res);
            });

            test('page no numérico: 400', async () => {
                const res = await request(app)
                    .get('/venta?page=abc')
                    .set('Authorization', `Bearer ${token}`);

                expectBadRequest(res);
            });

            test('paginación + filtros combinados: total y páginas reflejan el subconjunto filtrado', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&tipo=venta&page=1&pageSize=1`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.total).toEqual(2);
                expect(res.body.data).toHaveLength(1);
            });
        });
    });
});
