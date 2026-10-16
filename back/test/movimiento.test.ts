import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request, { Response } from 'supertest';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { eq } from 'drizzle-orm';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { movimientosTable } from '../src/modules/movimiento/movimiento.schema';
import { isbn } from '../seeders/data';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectBadRequest, expectCreated, expectNotFound, getMedioPagoId } from './util';

const container = createContainer({
    afipService: createMockAfipService(),
    comprobanteService: createMockComprobanteService()
});
const app = createApp(container);

let token: string;
let otroToken: string;
let efectivoId: number;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

const crearDeposito = async (nombre: string, t = token) => {
    const res = await auth(request(app).post('/deposito/').send({ nombre }), t);
    expectCreated(res);
    return res.body.data as { id: number; nombre: string; principal: boolean };
};

const crearLibro = async (isbnLibro: string, titulo: string, precio = 1000, t = token) => {
    const res = await auth(
        request(app).post('/libro/').send({ isbn: isbnLibro, titulo, fecha_edicion: '2020-01-01', precio }),
        t
    );
    expectCreated(res);
    return res.body.data;
};

const principal = async (t = token) =>
    (await auth(request(app).get('/deposito/'), t)).body.data.find((d: { principal: boolean }) => d.principal) as {
        id: number;
        nombre: string;
    };

const movimiento = (origen: unknown, destino: unknown, libros: unknown, t = token) =>
    auth(request(app).post('/movimiento/').send({ origen, destino, libros }), t);

const ingreso = (depositoId: number, libros: unknown, t = token) =>
    movimiento({ tipo: 'exterior' }, { tipo: 'deposito', id: depositoId }, libros, t);

const stockDe = async (isbnLibro: string, t = token) =>
    (await auth(request(app).get(`/libro/${isbnLibro}`), t)).body.data as {
        stock: number;
        disponible_principal: number;
        precio: number;
    };

const cantidadEn = async (depositoId: number, isbnLibro: string, t = token): Promise<number> => {
    const res = await auth(request(app).get(`/deposito/${depositoId}/libros`), t);

    return res.body.data.libros.find((l: { isbn: string }) => l.isbn === isbnLibro)?.cantidad ?? 0;
};

let depA: { id: number; nombre: string };
let depB: { id: number; nombre: string };
let depPrincipal: { id: number; nombre: string };

beforeAll(async () => {
    const [res, otroRes] = await Promise.all([
        request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED })
    ]);
    token = res.body.token;
    otroToken = otroRes.body.token;
    efectivoId = await getMedioPagoId(app, token, 'efectivo');

    depPrincipal = await principal();
    depA = await crearDeposito('Depósito A movimientos');
    depB = await crearDeposito('Depósito B movimientos');

    await crearLibro(isbn(9801), 'Movimiento uno');
    await crearLibro(isbn(9802), 'Movimiento dos');
    await crearLibro(isbn(9803), 'Movimiento tres');
});

afterAll(() => {
    db.$client.end();
});

describe('POST /movimiento: validaciones 400', () => {
    const depositoValido = () => ({ tipo: 'deposito', id: depA.id });

    it('rechaza exterior → exterior', async () => {
        const res = await movimiento({ tipo: 'exterior' }, { tipo: 'exterior' }, [{ isbn: isbn(9801), cantidad: 1 }]);
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('rechaza origen y destino iguales', async () => {
        const res = await movimiento(depositoValido(), depositoValido(), [{ isbn: isbn(9801), cantidad: 1 }]);
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('rechaza un extremo de tipo cliente', async () => {
        const res = await movimiento({ tipo: 'cliente', id: 1 }, depositoValido(), [{ isbn: isbn(9801), cantidad: 1 }]);
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('rechaza un depósito sin id', async () => {
        const res = await movimiento({ tipo: 'deposito' }, { tipo: 'exterior' }, [{ isbn: isbn(9801), cantidad: 1 }]);
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('rechaza un exterior con id', async () => {
        const res = await movimiento({ tipo: 'exterior', id: 1 }, depositoValido(), [{ isbn: isbn(9801), cantidad: 1 }]);
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('rechaza sin origen, sin destino o sin libros', async () => {
        const sinOrigen = await auth(request(app).post('/movimiento/').send({ destino: depositoValido(), libros: [{ isbn: isbn(9801), cantidad: 1 }] }));
        const sinDestino = await auth(request(app).post('/movimiento/').send({ origen: { tipo: 'exterior' }, libros: [{ isbn: isbn(9801), cantidad: 1 }] }));
        const sinLibros = await auth(request(app).post('/movimiento/').send({ origen: { tipo: 'exterior' }, destino: depositoValido() }));

        expectBadRequest(sinOrigen);
        expectBadRequest(sinDestino);
        expectBadRequest(sinLibros);
        expect(sinOrigen.status).toBe(400);
        expect(sinDestino.status).toBe(400);
        expect(sinLibros.status).toBe(400);
    });

    it('rechaza libros vacío', async () => {
        const res = await ingreso(depA.id, []);
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('rechaza cantidades menores o iguales a 0, no enteras o no numéricas', async () => {
        for (const cantidad of [0, -1, 1.5, 'dos']) {
            const res = await ingreso(depA.id, [{ isbn: isbn(9801), cantidad }]);
            expectBadRequest(res);
            expect(res.status).toBe(400);
        }
    });

    it('rechaza el mismo isbn repetido en la lista', async () => {
        const res = await ingreso(depA.id, [
            { isbn: isbn(9801), cantidad: 1 },
            { isbn: isbn(9801), cantidad: 2 }
        ]);
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });
});

describe('POST /movimiento: 404', () => {
    it('depósito inexistente o de otro usuario', async () => {
        const inexistente = await ingreso(999999, [{ isbn: isbn(9801), cantidad: 1 }]);
        expectNotFound(inexistente);
        expect(inexistente.status).toBe(404);

        const ajeno = await crearDeposito('Depósito ajeno', otroToken);
        const deOtro = await ingreso(ajeno.id, [{ isbn: isbn(9801), cantidad: 1 }]);
        expectNotFound(deOtro);
        expect(deOtro.status).toBe(404);
    });

    it('libro inexistente o de otro usuario', async () => {
        const inexistente = await ingreso(depA.id, [{ isbn: isbn(9899), cantidad: 1 }]);
        expectNotFound(inexistente);
        expect(inexistente.status).toBe(404);

        const libroAjeno = await crearLibro(isbn(9898), 'Libro ajeno', 100, otroToken);
        const deOtro = await ingreso(depA.id, [{ isbn: libroAjeno.isbn, cantidad: 1 }]);
        expectNotFound(deOtro);
        expect(deOtro.status).toBe(404);
    });
});

describe('ingreso, baja y transferencia', () => {
    it('un ingreso crea stock y devuelve el movimiento con origen, destino y libros', async () => {
        const res = await ingreso(depA.id, [{ isbn: isbn(9801), cantidad: 4 }]);

        expect(res.status).toBe(201);
        expect(res.body.data.id).toBeTypeOf('number');
        expect(res.body.data.fecha).toBeTruthy();
        expect(res.body.data.origen).toEqual({ tipo: 'exterior' });
        expect(res.body.data.destino).toMatchObject({ tipo: 'deposito', id: depA.id, nombre: depA.nombre });
        expect(res.body.data.libros).toEqual([{ isbn: isbn(9801), titulo: 'Movimiento uno', cantidad: 4 }]);

        const deposito = await auth(request(app).get(`/deposito/${depA.id}`));
        expect(deposito.body.data.ejemplares).toBe(4);
    });

    it('un ingreso sobre un depósito con stock suma (no reemplaza)', async () => {
        await ingreso(depA.id, [{ isbn: isbn(9801), cantidad: 3 }]);

        expect(await cantidadEn(depA.id, isbn(9801))).toBe(7);
        expect((await stockDe(isbn(9801))).stock).toBe(7);
    });

    it('una baja resta del origen y si queda en 0 el libro desaparece del depósito', async () => {
        await ingreso(depA.id, [{ isbn: isbn(9802), cantidad: 5 }]);
        const res = await movimiento({ tipo: 'deposito', id: depA.id }, { tipo: 'exterior' }, [{ isbn: isbn(9802), cantidad: 5 }]);

        expect(res.status).toBe(201);
        const libros = await auth(request(app).get(`/deposito/${depA.id}/libros`));
        expect(libros.body.data.libros.map((l: { isbn: string }) => l.isbn)).not.toContain(isbn(9802));
    });

    it('una transferencia baja del origen y sube en el destino; el total no cambia', async () => {
        await ingreso(depA.id, [{ isbn: isbn(9803), cantidad: 6 }]);
        const antesTotal = await stockDe(isbn(9803));
        const antesEnA = await cantidadEn(depA.id, isbn(9803));

        const res = await movimiento({ tipo: 'deposito', id: depA.id }, { tipo: 'deposito', id: depB.id }, [
            { isbn: isbn(9803), cantidad: 2 }
        ]);
        expect(res.status).toBe(201);

        const enB = await auth(request(app).get(`/deposito/${depB.id}/libros`));
        expect(enB.body.data.libros).toContainEqual({ isbn: isbn(9803), titulo: 'Movimiento tres', cantidad: 2 });

        expect(await cantidadEn(depA.id, isbn(9803))).toBe(antesEnA - 2);
        const despuesTotal = await stockDe(isbn(9803));
        expect(despuesTotal.stock).toBe(antesTotal.stock);
    });

    it('un ingreso o una baja cambian el stock total; una transferencia no, y el precio no cambia nunca', async () => {
        const inicial = await stockDe(isbn(9803));

        await ingreso(depA.id, [{ isbn: isbn(9803), cantidad: 1 }]);
        expect((await stockDe(isbn(9803))).stock).toBe(inicial.stock + 1);

        await movimiento({ tipo: 'deposito', id: depA.id }, { tipo: 'exterior' }, [{ isbn: isbn(9803), cantidad: 1 }]);
        expect((await stockDe(isbn(9803))).stock).toBe(inicial.stock);

        await movimiento({ tipo: 'deposito', id: depA.id }, { tipo: 'deposito', id: depB.id }, [{ isbn: isbn(9803), cantidad: 1 }]);
        expect((await stockDe(isbn(9803))).stock).toBe(inicial.stock);
        expect((await stockDe(isbn(9803))).precio).toBe(inicial.precio);
    });
});

describe('atomicidad y rechazo 409 por stock insuficiente', () => {
    it('devuelve 409 con el detalle por libro, sin aplicar nada ni dejar movimiento', async () => {
        // Estado previo controlado: un ingreso explícito a A.
        await ingreso(depA.id, [
            { isbn: isbn(9801), cantidad: 1 },
            { isbn: isbn(9802), cantidad: 1 }
        ]);

        const antes = await cantidadEn(depA.id, isbn(9801));
        const antesB = await cantidadEn(depA.id, isbn(9802));
        const totalAntes = (await auth(request(app).get('/movimiento/?porPagina=1'))).body.data.total;

        const res = await movimiento({ tipo: 'deposito', id: depA.id }, { tipo: 'exterior' }, [
            { isbn: isbn(9801), cantidad: antes + 1 },
            { isbn: isbn(9802), cantidad: 1 }
        ]);

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.errors[0].code).toBe('StockInsuficiente');
        expect(res.body.errors[0].libros).toHaveLength(1);
        expect(res.body.errors[0].libros[0]).toMatchObject({
            isbn: isbn(9801),
            titulo: 'Movimiento uno',
            pedido: antes + 1,
            disponible: antes
        });

        // Nada cambió: ni el libro que faltaba ni el que sí alcanzaba.
        expect(await cantidadEn(depA.id, isbn(9801))).toBe(antes);
        expect(await cantidadEn(depA.id, isbn(9802))).toBe(antesB);
        const totalDespues = (await auth(request(app).get('/movimiento/?porPagina=1'))).body.data.total;
        expect(totalDespues).toBe(totalAntes);
    });

    it('una baja o transferencia mayor a lo disponible devuelve 409 y no deja saldo negativo', async () => {
        const vacio = await crearDeposito('Depósito vacío de prueba');
        const res = await movimiento({ tipo: 'deposito', id: vacio.id }, { tipo: 'exterior' }, [
            { isbn: isbn(9801), cantidad: 1 }
        ]);

        expect(res.status).toBe(409);
        expect(res.body.errors[0].libros[0]).toMatchObject({ isbn: isbn(9801), pedido: 1, disponible: 0 });

        const deposito = await auth(request(app).get(`/deposito/${vacio.id}`));
        expect(deposito.body.data.ejemplares).toBe(0);
    });

    it('un movimiento con varios libros suficientes aplica todos y devuelve 201 una vez', async () => {
        const res = await ingreso(depA.id, [
            { isbn: isbn(9801), cantidad: 1 },
            { isbn: isbn(9802), cantidad: 1 }
        ]);

        expect(res.status).toBe(201);
        expect(res.body.data.libros).toHaveLength(2);
    });
});

describe('GET /movimiento', () => {
    beforeAll(async () => {
        // Tres movimientos para paginar con seguridad de orden.
        await ingreso(depB.id, [{ isbn: isbn(9801), cantidad: 1 }]);
        await ingreso(depB.id, [{ isbn: isbn(9802), cantidad: 1 }]);
        await ingreso(depB.id, [{ isbn: isbn(9803), cantidad: 1 }]);
    });

    it('pagina del más reciente al más antiguo con el sobre esperado y los libros incluidos', async () => {
        const res = await auth(request(app).get('/movimiento/?pagina=1&porPagina=2'));

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ pagina: 1, porPagina: 2 });
        expect(res.body.data.movimientos).toHaveLength(2);
        expect(res.body.data.total).toBeGreaterThanOrEqual(3);
        expect(res.body.data.totalPaginas).toBe(Math.ceil(res.body.data.total / 2));

        const ids = res.body.data.movimientos.map((m: { id: number }) => m.id);
        expect(ids).toEqual([...ids].sort((a, b) => b - a));
        for (const mov of res.body.data.movimientos) {
            expect(mov.libros.length).toBeGreaterThan(0);
            expect(mov.libros[0]).toMatchObject({ isbn: expect.any(String), titulo: expect.any(String), cantidad: expect.any(Number) });
            expect(mov.origen.tipo).toBe('exterior');
            expect(mov.destino.nombre).toBeTruthy();
        }
    });

    it('pedir una página más allá del total devuelve 200 con la lista vacía', async () => {
        const res = await auth(request(app).get('/movimiento/?pagina=99&porPagina=5'));

        expect(res.status).toBe(200);
        expect(res.body.data.movimientos).toEqual([]);
        expect(res.body.data.total).toBeGreaterThan(0);
    });

    it('página o tamaño inválidos devuelven 400', async () => {
        const paginaCero = await auth(request(app).get('/movimiento/?pagina=0'));
        const tamanoCero = await auth(request(app).get('/movimiento/?porPagina=0'));
        const paginaNoNumerica = await auth(request(app).get('/movimiento/?pagina=abc'));
        const tamanoNoEntero = await auth(request(app).get('/movimiento/?porPagina=1.5'));

        expectBadRequest(paginaCero);
        expectBadRequest(tamanoCero);
        expectBadRequest(paginaNoNumerica);
        expectBadRequest(tamanoNoEntero);
        expect([paginaCero.status, tamanoCero.status, paginaNoNumerica.status, tamanoNoEntero.status]).toEqual([400, 400, 400, 400]);
    });

    it('un usuario no ve los movimientos de otro', async () => {
        const propios = await auth(request(app).get('/movimiento/?porPagina=100'));
        const ajenos = await auth(request(app).get('/movimiento/?porPagina=100'), otroToken);

        const idsPropios = propios.body.data.movimientos.map((m: { id: number }) => m.id);
        const idsAjenos = ajenos.body.data.movimientos.map((m: { id: number }) => m.id);
        const idsAjenosSet = new Set<number>(idsAjenos);
        const compartidos = idsPropios.filter(idsAjenosSet.has.bind(idsAjenosSet));
        expect(compartidos).toEqual([]);
    });

    it('el detalle devuelve el movimiento con sus libros; id inexistente o ajeno da 404', async () => {
        const listado = await auth(request(app).get('/movimiento/?porPagina=1'));
        const id = listado.body.data.movimientos[0].id;

        const detalle = await auth(request(app).get(`/movimiento/${id}`));
        expect(detalle.status).toBe(200);
        expect(detalle.body.data.libros).toHaveLength(1);

        expectNotFound(await auth(request(app).get('/movimiento/999999')));
        expectNotFound(await auth(request(app).get(`/movimiento/${id}`), otroToken));
    });
});

describe('GET /movimiento - filtros', () => {
    const isbnsFiltro = [isbn(9851), isbn(9852)];

    const setFecha = async (idMovimiento: number, fecha: string) => {
        await db.update(movimientosTable).set({ fecha: new Date(fecha) }).where(eq(movimientosTable.id, idMovimiento));
    };
    const ids = (res: Response): number[] => res.body.data.movimientos.map((m: { id: number }) => m.id);

    let depFiltro: { id: number; nombre: string };
    let clienteFiltro: { id: number };
    let ingresoId: number;
    let transferenciaId: number;
    let bajaId: number;
    let ventaId: number;
    let consignacionId: number;
    let devolucionId: number;

    beforeAll(async () => {
        depFiltro = await crearDeposito('Depósito filtros movimientos');
        await crearLibro(isbnsFiltro[0], 'Libro filtro movimientos A', 1000);
        await crearLibro(isbnsFiltro[1], 'Libro filtro movimientos B', 1000);

        // depFiltro aparece como destino (ingreso) y como origen
        // (transferencia y baja), con fechas distintas para el filtro de rango.
        const resIngreso = await ingreso(depFiltro.id, [{ isbn: isbnsFiltro[0], cantidad: 5 }]);
        expectCreated(resIngreso);
        ingresoId = resIngreso.body.data.id;
        await setFecha(ingresoId, '2024-01-10T08:00:00');

        const resTransferencia = await movimiento(
            { tipo: 'deposito', id: depFiltro.id },
            { tipo: 'deposito', id: depB.id },
            [{ isbn: isbnsFiltro[0], cantidad: 2 }]
        );
        expectCreated(resTransferencia);
        transferenciaId = resTransferencia.body.data.id;
        await setFecha(transferenciaId, '2024-02-10T00:30:00');

        const resBaja = await movimiento(
            { tipo: 'deposito', id: depFiltro.id },
            { tipo: 'exterior' },
            [{ isbn: isbnsFiltro[0], cantidad: 1 }]
        );
        expectCreated(resBaja);
        bajaId = resBaja.body.data.id;
        await setFecha(bajaId, '2024-03-10T12:00:00');

        // Movimientos comerciales de un cliente propio: la venta trae el
        // cliente por `ventas.id_cliente`, la consignación por el depósito
        // destino y la devolución por el depósito origen.
        const resCliente = await auth(
            request(app)
                .post('/cliente/')
                .send({ nombre: 'Cliente filtros movimientos', email: 'filtrosmov@test.com', cuit: '20400000061' })
        );
        expectCreated(resCliente);
        clienteFiltro = resCliente.body.data;

        await ingreso(depPrincipal.id, [{ isbn: isbnsFiltro[1], cantidad: 10 }]);

        const resVenta = await auth(
            request(app)
                .post('/venta/')
                .send({ cliente: clienteFiltro.id, medio_pago: efectivoId, tipo_cbte: 11, libros: [{ isbn: isbnsFiltro[1], cantidad: 1 }] })
        );
        expectCreated(resVenta);
        ventaId = resVenta.body.data.id;

        const resConsignacion = await auth(
            request(app).post('/consignacion/').send({ cliente: clienteFiltro.id, libros: [{ isbn: isbnsFiltro[1], cantidad: 2 }] })
        );
        expectCreated(resConsignacion);
        consignacionId = resConsignacion.body.data.id;

        const resDevolucion = await auth(
            request(app).post('/devolucion/').send({ cliente: clienteFiltro.id, libros: [{ isbn: isbnsFiltro[1], cantidad: 1 }] })
        );
        expectCreated(resDevolucion);
        devolucionId = resDevolucion.body.data.id;
    });

    it('deposito: trae los movimientos donde es origen o destino y el total acompaña', async () => {
        const res = await auth(request(app).get(`/movimiento/?deposito=${depFiltro.id}&porPagina=100`));

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(3);
        expect(ids(res).sort()).toEqual([ingresoId, transferenciaId, bajaId].sort());
        for (const mov of res.body.data.movimientos) {
            const extremos = [mov.origen.id, mov.destino.id].filter((id: number | undefined) => id !== undefined);
            expect(extremos).toContain(depFiltro.id);
        }
    });

    it('deposito + paginación: el total refleja el filtro aunque la página traiga una sola fila', async () => {
        const res = await auth(request(app).get(`/movimiento/?deposito=${depFiltro.id}&pagina=1&porPagina=1`));

        expect(res.status).toBe(200);
        expect(res.body.data.movimientos).toHaveLength(1);
        expect(res.body.data.total).toBe(3);
        expect(res.body.data.totalPaginas).toBe(3);
    });

    it('tipo: sólo devuelve movimientos de ese tipo', async () => {
        const res = await auth(request(app).get('/movimiento/?tipo=transferencia&porPagina=1000'));

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBeGreaterThan(0);
        for (const mov of res.body.data.movimientos) expect(mov.tipo).toBe('transferencia');
        expect(res.body.data.total).toBe(res.body.data.movimientos.length);
    });

    it('tipo + deposito combinados con AND', async () => {
        const res = await auth(request(app).get(`/movimiento/?deposito=${depFiltro.id}&tipo=baja&porPagina=100`));

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(1);
        expect(ids(res)).toEqual([bajaId]);
    });

    it('tipo fuera del conjunto: 400', async () => {
        const res = await auth(request(app).get('/movimiento/?tipo=no-existe'));
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('cliente: trae venta, consignación y devolución de ese cliente', async () => {
        const res = await auth(request(app).get(`/movimiento/?cliente=${clienteFiltro.id}&porPagina=100`));

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(3);
        expect(ids(res).sort()).toEqual([ventaId, consignacionId, devolucionId].sort());
        for (const mov of res.body.data.movimientos) expect(mov.cliente.id).toBe(clienteFiltro.id);
    });

    it('cliente o depósito no numéricos: 400', async () => {
        const depositoInvalido = await auth(request(app).get('/movimiento/?deposito=abc'));
        const clienteInvalido = await auth(request(app).get('/movimiento/?cliente=abc'));

        expectBadRequest(depositoInvalido);
        expectBadRequest(clienteInvalido);
        expect([depositoInvalido.status, clienteInvalido.status]).toEqual([400, 400]);
    });

    it('desde/hasta: rango por día con `hasta` inclusive', async () => {
        const soloDesde = await auth(request(app).get(`/movimiento/?deposito=${depFiltro.id}&desde=2024-02-01&porPagina=100`));
        expect(soloDesde.body.data.total).toBe(2);
        expect(ids(soloDesde).sort()).toEqual([transferenciaId, bajaId].sort());

        // La transferencia del 10/02 a las 00:30 entra con `hasta=2024-02-10`
        // (fin del día), no con una comparación a las 00:00.
        const soloHasta = await auth(request(app).get(`/movimiento/?deposito=${depFiltro.id}&hasta=2024-02-10&porPagina=100`));
        expect(soloHasta.body.data.total).toBe(2);
        expect(ids(soloHasta).sort()).toEqual([ingresoId, transferenciaId].sort());

        const rango = await auth(request(app).get(`/movimiento/?deposito=${depFiltro.id}&desde=2024-01-01&hasta=2024-01-31&porPagina=100`));
        expect(rango.body.data.total).toBe(1);
        expect(ids(rango)).toEqual([ingresoId]);
    });

    it('desde posterior a hasta: 400', async () => {
        const res = await auth(request(app).get('/movimiento/?desde=2024-05-01&hasta=2024-01-01'));
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('un usuario no ve movimientos filtrados por un depósito ajeno', async () => {
        const res = await auth(request(app).get(`/movimiento/?deposito=${depFiltro.id}&porPagina=100`), otroToken);

        expect(res.status).toBe(200);
        expect(res.body.data.total).toBe(0);
        expect(res.body.data.movimientos).toEqual([]);
    });
});

describe('stock y disponible_principal del libro', () => {
    const isbnLibro = isbn(9811);

    beforeAll(async () => {
        await crearLibro(isbnLibro, 'Libro de stock derivado');
        await ingreso(depA.id, [{ isbn: isbnLibro, cantidad: 5 }]);
        await movimiento({ tipo: 'deposito', id: depA.id }, { tipo: 'deposito', id: depB.id }, [
            { isbn: isbnLibro, cantidad: 2 }
        ]);
    });

    it('el stock total es la suma y disponible_principal es lo del principal', async () => {
        const res = await auth(request(app).get(`/libro/${isbnLibro}`));

        expect(res.body.data.stock).toBe(5);
        expect(res.body.data.disponible_principal).toBe(0);
        expect(res.body.data.disponible_principal).not.toBe(res.body.data.stock);
    });

    it('GET /libro y GET /libro/lista_libros informan el mismo total y disponible', async () => {
        const listado = await auth(request(app).get(`/libro?isbn=${isbnLibro}`));
        expect(listado.body.items[0]).toMatchObject({ stock: 5, disponible_principal: 0 });

        const csv = await auth(request(app).get('/libro/lista_libros'));
        expect(csv.status).toBe(200);
        expect(csv.text).toContain('disponible_principal');
    });

    it('un libro sin stock informa 0 y 0', async () => {
        const res = await auth(request(app).get(`/libro/${isbn(9890)}`));
        expectNotFound(res);
        expect(res.status).toBe(404);

        await crearLibro(isbn(9890), 'Libro sin stock');
        const libro = await auth(request(app).get(`/libro/${isbn(9890)}`));
        expect(libro.body.data).toMatchObject({ stock: 0, disponible_principal: 0 });
    });

    it('POST /libro con stock en el body devuelve 400', async () => {
        const res = await auth(
            request(app).post('/libro/').send({ isbn: isbn(9891), titulo: 'Con stock', fecha_edicion: '2020-01-01', precio: 100, stock: 5 })
        );
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('PUT /libro/:isbn con stock en el body devuelve 400', async () => {
        const res = await auth(request(app).put(`/libro/${isbnLibro}`).send({ stock: 5 }));
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });
});

describe('GET /deposito/:id/libros y GET /libro/:isbn/depositos', () => {
    const isbnLibro = isbn(9821);

    beforeAll(async () => {
        await crearLibro(isbnLibro, 'Libro desglosado');
        await ingreso(depA.id, [{ isbn: isbnLibro, cantidad: 4 }]);
        await movimiento({ tipo: 'deposito', id: depA.id }, { tipo: 'deposito', id: depB.id }, [
            { isbn: isbnLibro, cantidad: 1 }
        ]);
    });

    it('lista sólo los libros con cantidad mayor a 0, con isbn, título y cantidad', async () => {
        const res = await auth(request(app).get(`/deposito/${depA.id}/libros`));

        expect(res.status).toBe(200);
        expect(res.body.data.deposito.id).toBe(depA.id);
        const libro = res.body.data.libros.find((l: { isbn: string }) => l.isbn === isbnLibro);
        expect(libro).toMatchObject({ isbn: isbnLibro, titulo: 'Libro desglosado', cantidad: 3 });
    });

    it('un libro sin registro en el depósito no aparece', async () => {
        const res = await auth(request(app).get(`/deposito/${depB.id}/libros`));
        expect(res.body.data.libros.map((l: { isbn: string }) => l.isbn)).not.toContain(isbn(9890));
    });

    it('el desglose de un libro devuelve cada depósito con id, nombre y cantidad, y el total', async () => {
        const res = await auth(request(app).get(`/libro/${isbnLibro}/depositos`));

        expect(res.status).toBe(200);
        expect(res.body.data.isbn).toBe(isbnLibro);
        expect(res.body.data.total).toBe(4);
        const porDeposito = res.body.data.depositos.map((d: { id: number; cantidad: number }) => [d.id, d.cantidad]);
        expect(porDeposito).toEqual(
            expect.arrayContaining([
                [depA.id, 3],
                [depB.id, 1]
            ])
        );
        for (const d of res.body.data.depositos) expect(d.nombre).toBeTruthy();
    });

    it('un libro sin stock en ningún depósito devuelve 200 con lista vacía y total 0', async () => {
        await crearLibro(isbn(9822), 'Libro sin depósitos');
        const res = await auth(request(app).get(`/libro/${isbn(9822)}/depositos`));

        expect(res.status).toBe(200);
        expect(res.body.data).toMatchObject({ total: 0, depositos: [] });
    });

    it('depósito o libro inexistente o de otro usuario devuelven 404', async () => {
        const depositoInexistente = await auth(request(app).get('/deposito/999999/libros'));
        const libroInexistente = await auth(request(app).get(`/libro/${isbn(9821)}999/depositos`));
        expectNotFound(depositoInexistente);
        expectNotFound(libroInexistente);

        const ajeno = await crearDeposito('Ajeno para consulta', otroToken);
        const depositoAjeno = await auth(request(app).get(`/deposito/${ajeno.id}/libros`));
        expectNotFound(depositoAjeno);

        const libroAjeno = await crearLibro(isbn(9823), 'Libro ajeno', 100, otroToken);
        const libroDeOtro = await auth(request(app).get(`/libro/${libroAjeno.isbn}/depositos`));
        expectNotFound(libroDeOtro);
        expect([depositoInexistente.status, libroInexistente.status, depositoAjeno.status, libroDeOtro.status]).toEqual([404, 404, 404, 404]);
    });
});

describe('las operaciones existentes mueven el depósito principal', () => {
    const isbnOperacion = isbn(9831);
    let cliente: { id: number };
    let clienteNegro: { id: number };

    beforeAll(async () => {
        const resCliente = await auth(
            request(app).post('/cliente/').send({ nombre: 'Cliente operaciones principal', email: 'ops@test.com', cuit: '20400000031' })
        );
        expectCreated(resCliente);
        cliente = resCliente.body.data;

        const resNegro = await auth(request(app).get('/cliente?tipo=negro'));
        clienteNegro = resNegro.body.items[0];

        await crearLibro(isbnOperacion, 'Libro de operaciones', 1000);
        await ingreso(depPrincipal.id, [{ isbn: isbnOperacion, cantidad: 10 }]);
    });

    it('una venta reduce el principal y el total', async () => {
        const res = await auth(
            request(app).post('/venta/').send({ cliente: clienteNegro.id, medio_pago: efectivoId, tipo_cbte: 11, libros: [{ isbn: isbnOperacion, cantidad: 3 }] })
        );
        expect(res.status).toBe(201);

        const libro = await stockDe(isbnOperacion);
        expect(libro.disponible_principal).toBe(7);
        expect(libro.stock).toBe(7);
    });

    it('una transferencia posterior separa el total del principal', async () => {
        await movimiento({ tipo: 'deposito', id: depPrincipal.id }, { tipo: 'deposito', id: depA.id }, [
            { isbn: isbnOperacion, cantidad: 2 }
        ]);

        const libro = await stockDe(isbnOperacion);
        expect(libro.disponible_principal).toBe(5);
        expect(libro.stock).toBe(7);
    });

    it('una consignación baja el principal pero NO el total (pasa al depósito del cliente)', async () => {
        const res = await auth(request(app).post('/consignacion/').send({ cliente: cliente.id, libros: [{ isbn: isbnOperacion, cantidad: 2 }] }));
        expect(res.status).toBe(201);

        const libro = await stockDe(isbnOperacion);
        expect(libro.disponible_principal).toBe(3);
        expect(libro.stock).toBe(7);

        const stockCliente = await auth(request(app).get(`/cliente/${cliente.id}/stock`));
        const enCliente = stockCliente.body.data.find((l: { isbn: string }) => l.isbn === isbnOperacion);
        expect(enCliente.stock).toBe(2);
    });

    it('una devolución sube el principal y el total no cambia', async () => {
        const res = await auth(request(app).post('/devolucion/').send({ cliente: cliente.id, libros: [{ isbn: isbnOperacion, cantidad: 1 }] }));
        expect(res.status).toBe(201);

        const libro = await stockDe(isbnOperacion);
        expect(libro.disponible_principal).toBe(4);
        expect(libro.stock).toBe(7);
    });

    it('una venta-consignación no toca el principal y baja el total (sale al exterior)', async () => {
        const antes = await stockDe(isbnOperacion);

        const res = await auth(
            request(app)
                .post('/ventaConsignacion/')
                .send({
                    cliente: cliente.id,
                    libros: [{ isbn: isbnOperacion, cantidad: 1 }],
                    fecha_venta: new Date().toISOString(),
                    medio_pago: efectivoId,
                    tipo_cbte: 11
                })
        );
        expect(res.status).toBe(201);

        const despues = await stockDe(isbnOperacion);
        expect(despues.disponible_principal).toBe(antes.disponible_principal);
        expect(despues.stock).toBe(antes.stock - 1);
    });
});
