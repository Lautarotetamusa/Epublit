import {describe, expect, test, beforeAll, afterAll} from 'vitest';
import request from "supertest";
import { and, eq, isNotNull } from 'drizzle-orm';

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({path: join(__dirname, "../.env")});

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { movimientosTable } from '../src/modules/movimiento/movimiento.schema';
import { depositosTable } from '../src/modules/deposito/deposito.schema';
import {expectBadRequest, expectConflict, expectDataResponse, expectCreated, expectNotFound, cargarStockPrincipal, getMedioPagoId} from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';

const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

let token: string;
let clienteInscripto: { id: number; tipo: string };
let clienteNegro: { id: number; tipo: string };
let efectivoId: number;
let transferenciaId: number;

// Libros propios (no seedeados) para no interferir con el stock que otros
// archivos de test puedan estar leyendo de los libros del seed.
const isbnsVenta = [isbn(9994), isbn(9993), isbn(9992)];

let venta: any = {};

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

    token = res.body.token;
    efectivoId = await getMedioPagoId(app, token, 'efectivo');
    transferenciaId = await getMedioPagoId(app, token, 'transferencia');
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
                    .send({ isbn: isbnLibro, titulo: 'Test venta', fecha_edicion: '2020-01-01', precio: 1000 });

                expectCreated(res);
                // El stock ya no se carga en el alta: se carga con un ingreso al
                // depósito principal (ver specs/008-movimientos-deposito).
                const movimiento = await cargarStockPrincipal(app, token, isbnLibro, 3);
                expect(movimiento.status).toBe(201);
                venta.libros.push({ isbn: isbnLibro, cantidad: 3 });
            }
        });
    });

    describe('POST /venta', () => {
        describe('Bad request', () => {
            test('Venta no tiene cliente', async () => {
                const { cliente, ...sinCliente } = { ...venta, cliente: clienteInscripto?.id, medio_pago: efectivoId, tipo_cbte: 11 };

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
                    .send({ cliente: clienteInscripto.id, medio_pago: efectivoId, tipo_cbte: 11, libros: [] });
                expectBadRequest(res);
            });

            test('Medio de pago incorrecto', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ cliente: clienteInscripto.id, medio_pago: 'bitcoin', tipo_cbte: 11, libros: venta.libros });
                expectBadRequest(res);
            });

            test('Un libro no tiene suficiente stock: 409 con detalle por libro', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: clienteInscripto.id,
                        medio_pago: efectivoId,
                        tipo_cbte: 11,
                        libros: [{ isbn: isbnsVenta[0], cantidad: 999 }]
                    });
                expectConflict(res);
                expect(res.body.errors[0].code).toBe('StockInsuficiente');
                expect(res.body.errors[0].libros[0]).toMatchObject({ isbn: isbnsVenta[0], pedido: 999 });
            });
        });

        describe('Venta a un cliente no "negro": factura via AFIP', () => {
            test('vender', async () => {
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: clienteInscripto.id,
                        medio_pago: efectivoId,
                        tipo_cbte: 11,
                        libros: [{ isbn: isbnsVenta[0], cantidad: 2 }]
                    });

                expectDataResponse(res, 201);
                expect(res.body.data.comprobante).toMatchObject({
                    clase: "factura",
                    estado: "emitida"
                });
                venta.id = res.body.data.id;
                venta.comprobanteId = res.body.data.comprobante.id;
            });

            test('GET venta creada', async () => {
                const res = await request(app)
                    .get(`/venta/${venta.id}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data.type).toEqual('venta');
                expect(res.body.data.libros).toHaveLength(1);
                expect(res.body.data.comprobante).toMatchObject({
                    id: venta.comprobanteId,
                    clase: 'factura',
                    estado: 'emitida'
                });
                // El detalle informa el stock derivado del libro (lo que quedó
                // en el depósito principal tras la venta), no la columna legada.
                expect(res.body.data.libros[0]).toMatchObject({ isbn: isbnsVenta[0], stock: 1 });
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
                const res = await request(app)
                    .post('/venta/')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        cliente: clienteNegro.id,
                        medio_pago: efectivoId,
                        tipo_cbte: 11,
                        libros: [{ isbn: isbnsVenta[1], cantidad: 1 }]
                    });

                expectDataResponse(res, 201);
                expect(res.body.data.comprobante).toBeNull();
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
                "fecha", "cuit", "nombre_cliente", "email", "cond_fiscal", "comprobante"];
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

        const setFecha = async (idMovimiento: number, fecha: string) => {
            await db.update(movimientosTable).set({ fecha: new Date(fecha) }).where(eq(movimientosTable.id, idMovimiento));
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
                    .send({ isbn: isbnLibro, titulo: 'Test filtro ventas', fecha_edicion: '2020-01-01', precio: 500 });
                expectCreated(res);
                const movimiento = await cargarStockPrincipal(app, token, isbnLibro, 10);
                expect(movimiento.status).toBe(201);
            }

            let res = await request(app)
                .post('/venta/')
                .set('Authorization', `Bearer ${token}`)
                .send({ cliente: clienteFiltro.id, medio_pago: efectivoId, tipo_cbte: 11, libros: [{ isbn: isbnsFiltro[0], cantidad: 1 }] });
            expectCreated(res);
            ventaEfectivoId = res.body.data.id;
            await setFecha(ventaEfectivoId, '2024-01-10');

            res = await request(app)
                .post('/venta/')
                .set('Authorization', `Bearer ${token}`)
                .send({ cliente: clienteFiltro.id, medio_pago: transferenciaId, tipo_cbte: 11, libros: [{ isbn: isbnsFiltro[0], cantidad: 1 }] });
            expectCreated(res);
            ventaTransferenciaId = res.body.data.id;
            await setFecha(ventaTransferenciaId, '2024-02-10');

            // Venta sobre consignado: la consignación previa mueve el stock al
            // depósito del cliente y congela el precio (ver
            // specs/009-ledger-unificado).
            res = await request(app)
                .post('/consignacion/')
                .set('Authorization', `Bearer ${token}`)
                .send({ cliente: clienteFiltro.id, libros: [{ isbn: isbnsFiltro[1], cantidad: 5 }] });
            expectCreated(res);

            res = await request(app)
                .post('/ventaConsignacion/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    cliente: clienteFiltro.id,
                    libros: [{ isbn: isbnsFiltro[1], cantidad: 1 }],
                    fecha_venta: new Date().toISOString(),
                    medio_pago: efectivoId,
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
                    .get(`/venta?cliente=${clienteFiltro.id}&medioPago=${transferenciaId}`)
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
                    .get(`/venta?cliente=${clienteFiltro.id}&tipo=venta&medioPago=${efectivoId}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.data).toHaveLength(1);
                expect(res.body.data[0].id).toEqual(ventaEfectivoId);
            });

            test('combo que no matchea ninguna venta: 200 con lista vacía', async () => {
                const res = await request(app)
                    .get(`/venta?cliente=${clienteFiltro.id}&tipo=ventaConsignacion&medioPago=${transferenciaId}`)
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

describe('POST /venta con deposito_id (specs/018)', () => {
    const isbnLibro = isbn(9991);
    let depositoId: number;
    let principalId: number;
    let depositoAjenoId: number;
    let clienteId: number;

    const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

    async function cantidadEnDeposito(deposito: number, isbnLibro: string): Promise<number> {
        const res = await auth(request(app).get(`/deposito/${deposito}/libros`));
        return res.body.data.libros.find((l: { isbn: string }) => l.isbn === isbnLibro)?.cantidad ?? 0;
    }

    async function disponiblePrincipal(isbnLibro: string): Promise<number> {
        const res = await auth(request(app).get(`/libro/${isbnLibro}`));
        return res.body.data.disponible_principal;
    }

    const ventaBody = (extra: Record<string, unknown> = {}) => ({
        cliente: clienteId,
        libros: [{ isbn: isbnLibro, cantidad: 1 }],
        medio_pago: efectivoId,
        tipo_cbte: 11,
        ...extra
    });

    beforeAll(async () => {
        const clientes = await auth(request(app).get('/cliente?tipo=particular'));
        clienteId = clientes.body.items[0].id;

        const depositos = await auth(request(app).get('/deposito/'));
        principalId = depositos.body.data.find((d: { principal: boolean }) => d.principal).id;

        const creado = await auth(request(app).post('/deposito/').send({ nombre: 'Depósito 018 venta' }));
        depositoId = creado.body.data.id;

        await auth(request(app).post('/libro/').send({ isbn: isbnLibro, titulo: 'Test venta depósito', fecha_edicion: '2020-01-01', precio: 1000 }));

        const ingresoDeposito = await auth(
            request(app).post('/movimiento/').send({
                origen: { tipo: 'exterior' },
                destino: { tipo: 'deposito', id: depositoId },
                libros: [{ isbn: isbnLibro, cantidad: 5 }]
            })
        );
        expect(ingresoDeposito.status).toBe(201);
        const ingresoPrincipal = await cargarStockPrincipal(app, token, isbnLibro, 3);
        expect(ingresoPrincipal.status).toBe(201);

        const loginOtro = await request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED });
        const ajeno = await auth(request(app).post('/deposito/').send({ nombre: 'Depósito 018 ajeno' }), loginOtro.body.token);
        depositoAjenoId = ajeno.body.data.id;
    });

    test('descuenta del depósito elegido y lo informa como origen', async () => {
        const principalAntes = await disponiblePrincipal(isbnLibro);
        const depositoAntes = await cantidadEnDeposito(depositoId, isbnLibro);

        const res = await auth(request(app).post('/venta/').send(ventaBody({ deposito_id: depositoId })));

        expectCreated(res);
        expect(res.body.data.origen_deposito).toEqual({ id: depositoId, nombre: 'Depósito 018 venta' });
        expect(await cantidadEnDeposito(depositoId, isbnLibro)).toBe(depositoAntes - 1);
        expect(await disponiblePrincipal(isbnLibro)).toBe(principalAntes);
    });

    test('sin deposito_id usa el principal y lo informa como origen', async () => {
        const principalAntes = await disponiblePrincipal(isbnLibro);
        const depositoAntes = await cantidadEnDeposito(depositoId, isbnLibro);

        const res = await auth(request(app).post('/venta/').send(ventaBody()));

        expectCreated(res);
        expect(res.body.data.origen_deposito).toEqual({ id: principalId, nombre: 'Depósito principal' });
        expect(await disponiblePrincipal(isbnLibro)).toBe(principalAntes - 1);
        expect(await cantidadEnDeposito(depositoId, isbnLibro)).toBe(depositoAntes);
    });

    test('stock insuficiente en el depósito elegido: 409 y no modifica ningún depósito', async () => {
        const principalAntes = await disponiblePrincipal(isbnLibro);
        const depositoAntes = await cantidadEnDeposito(depositoId, isbnLibro);

        const res = await auth(
            request(app).post('/venta/').send(ventaBody({ deposito_id: depositoId, libros: [{ isbn: isbnLibro, cantidad: 99 }] }))
        );

        expectConflict(res);
        expect(res.body.errors[0].code).toBe('StockInsuficiente');
        expect(await cantidadEnDeposito(depositoId, isbnLibro)).toBe(depositoAntes);
        expect(await disponiblePrincipal(isbnLibro)).toBe(principalAntes);
    });

    test('depósito inexistente devuelve 404', async () => {
        const res = await auth(request(app).post('/venta/').send(ventaBody({ deposito_id: 999999 })));
        expectNotFound(res);
    });

    test('depósito de otro usuario devuelve 404', async () => {
        const res = await auth(request(app).post('/venta/').send(ventaBody({ deposito_id: depositoAjenoId })));
        expectNotFound(res);
    });

    test('depósito propio de un cliente devuelve 404', async () => {
        const [depositoDeCliente] = await db
            .select({ id: depositosTable.id })
            .from(depositosTable)
            .where(and(eq(depositosTable.user, 1), isNotNull(depositosTable.id_cliente)))
            .limit(1);
        expect(depositoDeCliente).toBeDefined();

        const res = await auth(request(app).post('/venta/').send(ventaBody({ deposito_id: depositoDeCliente.id })));
        expectNotFound(res);
    });
});
