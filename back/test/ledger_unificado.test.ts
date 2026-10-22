import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { isbn, cuit } from '../seeders/data';
import { env } from '../src/env';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectCreated, expectNotFound, cargarStockPrincipal, getMedioPagoId } from './util';
import { depositosTable } from '../src/modules/deposito/deposito.schema';
import { depositoLibrosTable } from '../src/modules/deposito/depositoLibros.schema';

const container = createContainer({
    afipService: createMockAfipService(),
    comprobanteService: createMockComprobanteService()
});
const app = createApp(container);

let token: string;
let efectivoId: number;
const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

const crearCliente = async (nombre: string, cuitCliente: string) => {
    const res = await auth(request(app).post('/cliente/').send({ nombre, email: 'ledger@test.com', cuit: cuitCliente }));
    expectCreated(res);
    return res.body.data as { id: number; nombre: string; user: number };
};

const crearLibro = async (isbnLibro: string, titulo: string, precio = 1000) => {
    const res = await auth(
        request(app).post('/libro/').send({ isbn: isbnLibro, titulo, fecha_edicion: '2020-01-01', precio })
    );
    expectCreated(res);
    return res.body.data;
};

const depositoDeCliente = async (clienteId: number) => {
    const [deposito] = await db.select().from(depositosTable).where(eq(depositosTable.id_cliente, clienteId));
    return deposito;
};

const stockDeLibro = async (isbnLibro: string) =>
    (await auth(request(app).get(`/libro/${isbnLibro}`))).body.data as { stock: number; disponible_principal: number };

const stockDeCliente = async (clienteId: number) =>
    (await auth(request(app).get(`/cliente/${clienteId}/stock`))).body.data as { isbn: string; stock: number; precio: number }[];

beforeAll(async () => {
    const res = await request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED });
    token = res.body.token;
    efectivoId = await getMedioPagoId(app, token, 'efectivo');
});

afterAll(() => {
    db.$client.end();
});

describe('depósito propio de cada cliente', () => {
    it('el alta crea un depósito real propio, vacío, fuera de GET /deposito/', async () => {
        const cliente = await crearCliente('Cliente ledger uno', cuit(9900));
        const deposito = await depositoDeCliente(cliente.id);

        expect(deposito).toBeDefined();
        expect(deposito.principal).toBe(false);
        expect(deposito.nombre).toBe(cliente.nombre);

        const listado = await auth(request(app).get('/deposito/'));
        expect(listado.body.data.map((d: { id: number }) => d.id)).not.toContain(deposito.id);
    });

    it('dos clientes tienen dos depósitos distintos', async () => {
        const clienteA = await crearCliente('Cliente ledger dos', cuit(9901));
        const clienteB = await crearCliente('Cliente ledger tres', cuit(9902));

        const depositoA = await depositoDeCliente(clienteA.id);
        const depositoB = await depositoDeCliente(clienteB.id);

        expect(depositoA.id).not.toBe(depositoB.id);
    });

    it('el depósito de un cliente no es visible ni administrable por /deposito/:id (404)', async () => {
        const cliente = await crearCliente('Cliente ledger oculto', cuit(9903));
        const deposito = await depositoDeCliente(cliente.id);

        expectNotFound(await auth(request(app).get(`/deposito/${deposito.id}`)));
        expectNotFound(await auth(request(app).put(`/deposito/${deposito.id}`).send({ nombre: 'intruso' })));
        expectNotFound(await auth(request(app).delete(`/deposito/${deposito.id}`)));
        expectNotFound(await auth(request(app).get(`/deposito/${deposito.id}/libros`)));
    });
});

describe('movimientos manuales con el contrato unificado', () => {
    const isbnLibro = isbn(9860);
    let principal: { id: number };
    let depositoB: { id: number };

    beforeAll(async () => {
        const listado = await auth(request(app).get('/deposito/'));
        principal = listado.body.data.find((d: { principal: boolean }) => d.principal);

        const creado = await auth(request(app).post('/deposito/').send({ nombre: 'Depósito ledger B' }));
        expectCreated(creado);
        depositoB = creado.body.data;

        await crearLibro(isbnLibro, 'Libro ledger manual');
        await cargarStockPrincipal(app, token, isbnLibro, 10);
    });

    it('ingreso / baja / transferencia persisten su tipo y no exponen datos comerciales', async () => {
        const ingreso = await cargarStockPrincipal(app, token, isbnLibro, 1);
        expect(ingreso.status).toBe(201);
        const detalleIngreso = await auth(request(app).get(`/movimiento/${ingreso.body.data.id}`));
        expect(detalleIngreso.body.data).toMatchObject({ tipo: 'ingreso', cliente: null, file_path: null, venta: null });
        expect(detalleIngreso.body.data.libros[0]).not.toHaveProperty('precio');

        const baja = await auth(
            request(app).post('/movimiento/').send({
                origen: { tipo: 'deposito', id: principal.id },
                destino: { tipo: 'exterior' },
                libros: [{ isbn: isbnLibro, cantidad: 1 }]
            })
        );
        expect(baja.status).toBe(201);
        expect((await auth(request(app).get(`/movimiento/${baja.body.data.id}`))).body.data.tipo).toBe('baja');

        const transferencia = await auth(
            request(app).post('/movimiento/').send({
                origen: { tipo: 'deposito', id: principal.id },
                destino: { tipo: 'deposito', id: depositoB.id },
                libros: [{ isbn: isbnLibro, cantidad: 1 }]
            })
        );
        expect(transferencia.status).toBe(201);
        expect((await auth(request(app).get(`/movimiento/${transferencia.body.data.id}`))).body.data.tipo).toBe('transferencia');
    });

    it('no se puede usar el depósito de un cliente como extremo de un movimiento manual (404)', async () => {
        const cliente = await crearCliente('Cliente ledger manual', cuit(9904));
        const deposito = await depositoDeCliente(cliente.id);

        const res = await auth(
            request(app).post('/movimiento/').send({
                origen: { tipo: 'deposito', id: deposito.id },
                destino: { tipo: 'exterior' },
                libros: [{ isbn: isbnLibro, cantidad: 1 }]
            })
        );

        expectNotFound(res);
    });
});

describe('las operaciones comerciales son movimientos unificados', () => {
    const isbnLibro = isbn(9861);
    let cliente: { id: number; nombre: string };
    let clienteMostrador: { id: number };
    let principal: { id: number };
    const movimientosCreados: number[] = [];

    beforeAll(async () => {
        cliente = await crearCliente('Cliente ledger comercial', cuit(9905));

        const mostrador = await auth(request(app).get('/cliente?tipo=negro'));
        clienteMostrador = mostrador.body.items[0];

        const listado = await auth(request(app).get('/deposito/'));
        principal = listado.body.data.find((d: { principal: boolean }) => d.principal);

        await crearLibro(isbnLibro, 'Libro ledger comercial', 1000);
        await cargarStockPrincipal(app, token, isbnLibro, 20);
    });

    it('una venta deja un movimiento tipo venta con cliente, archivo y datos de venta', async () => {
        const res = await auth(
            request(app).post('/venta/').send({
                cliente: clienteMostrador.id,
                medio_pago: efectivoId,
                tipo_cbte: 11,
                libros: [{ isbn: isbnLibro, cantidad: 2 }]
            })
        );
        expect(res.status).toBe(201);
        movimientosCreados.push(res.body.data.id);

        const detalle = await auth(request(app).get(`/movimiento/${res.body.data.id}`));
        expect(detalle.body.data.tipo).toBe('venta');
        expect(detalle.body.data.cliente).toEqual({ id: clienteMostrador.id, nombre: expect.any(String) });
        expect(detalle.body.data.file_path).toContain(env.HOST);
        expect(detalle.body.data.venta).toMatchObject({
            tipo_cbte: 11,
            medio_pago: { nombre: 'efectivo', comision: 0 },
            neto: expect.any(Number)
        });
        expect(detalle.body.data.libros[0]).toMatchObject({ isbn: isbnLibro, cantidad: 2, precio: 1000 });
    });

    it('una consignación deja un movimiento tipo consignacion hacia el depósito del cliente, sin venta', async () => {
        const res = await auth(
            request(app).post('/consignacion/').send({ cliente: cliente.id, libros: [{ isbn: isbnLibro, cantidad: 5 }] })
        );
        expect(res.status).toBe(201);
        movimientosCreados.push(res.body.data.id);

        const detalle = await auth(request(app).get(`/movimiento/${res.body.data.id}`));
        expect(detalle.body.data.tipo).toBe('consignacion');
        expect(detalle.body.data.cliente).toEqual({ id: cliente.id, nombre: cliente.nombre });
        expect(detalle.body.data.file_path).toContain('http');
        expect(detalle.body.data.venta).toBeNull();

        const deposito = await depositoDeCliente(cliente.id);
        expect(detalle.body.data.destino).toMatchObject({ tipo: 'deposito', id: deposito.id });
        expect(detalle.body.data.libros[0].precio).toBe(1000);
    });

    it('la consignación no cambia el stock total y el desglose incluye el depósito del cliente', async () => {
        const libro = await stockDeLibro(isbnLibro);
        expect(libro.disponible_principal).toBe(13);

        const desglose = await auth(request(app).get(`/libro/${isbnLibro}/depositos`));
        const deposito = await depositoDeCliente(cliente.id);
        expect(desglose.body.data.total).toBe(libro.stock);
        expect(desglose.body.data.depositos).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: deposito.id, cantidad: 5 })])
        );
    });

    it('una venta sobre consignación deja un movimiento tipo ventaConsignacion con venta', async () => {
        const res = await auth(
            request(app).post('/ventaConsignacion/').send({
                cliente: cliente.id,
                libros: [{ isbn: isbnLibro, cantidad: 1 }],
                fecha_venta: new Date().toISOString(),
                medio_pago: efectivoId,
                tipo_cbte: 11
            })
        );
        expect(res.status).toBe(201);
        movimientosCreados.push(res.body.data.id);

        const detalle = await auth(request(app).get(`/movimiento/${res.body.data.id}`));
        expect(detalle.body.data.tipo).toBe('ventaConsignacion');
        expect(detalle.body.data.cliente).toEqual({ id: cliente.id, nombre: cliente.nombre });
        expect(detalle.body.data.venta).toMatchObject({ tipo_cbte: 11 });
        expect((await stockDeCliente(cliente.id)).find((l) => l.isbn === isbnLibro)?.stock).toBe(4);
    });

    it('una devolución deja un movimiento tipo devolucion con cliente y archivo', async () => {
        const res = await auth(
            request(app).post('/devolucion/').send({ cliente: cliente.id, libros: [{ isbn: isbnLibro, cantidad: 1 }] })
        );
        expect(res.status).toBe(201);
        movimientosCreados.push(res.body.data.id);

        const detalle = await auth(request(app).get(`/movimiento/${res.body.data.id}`));
        expect(detalle.body.data.tipo).toBe('devolucion');
        expect(detalle.body.data.cliente).toEqual({ id: cliente.id, nombre: cliente.nombre });
        expect(detalle.body.data.file_path).toContain('http');
        expect(detalle.body.data.venta).toBeNull();
    });

    it('el historial unificado incluye los siete tipos y distingue baja de venta', async () => {
        const listado = await auth(request(app).get('/movimiento/?porPagina=100'));
        const tipos = new Set(listado.body.data.movimientos.map((m: { tipo: string }) => m.tipo));

        expect(tipos.has('ingreso')).toBe(true);
        expect(tipos.has('venta')).toBe(true);
        expect(tipos.has('consignacion')).toBe(true);
        expect(tipos.has('ventaConsignacion')).toBe(true);
        expect(tipos.has('devolucion')).toBe(true);

        for (const id of movimientosCreados) {
            const detalle = await auth(request(app).get(`/movimiento/${id}`));
            expect(detalle.status).toBe(200);
            expect(detalle.body.data.libros.length).toBeGreaterThan(0);
        }
    });

    it('dar de baja el cliente no borra su depósito ni el nombre en el historial', async () => {
        const deposito = await depositoDeCliente(cliente.id);
        const cantidadesAntes = (
            await db.select().from(depositoLibrosTable).where(eq(depositoLibrosTable.deposito_id, deposito.id))
        ).map((fila) => `${fila.id_libro}:${fila.cantidad}`);

        const baja = await auth(request(app).delete(`/cliente/${cliente.id}`));
        expect(baja.status).toBe(200);

        // El depósito y sus cantidades siguen intactos...
        const depositoDespues = (await db.select().from(depositosTable).where(eq(depositosTable.id, deposito.id)))[0];
        expect(depositoDespues).toBeDefined();
        expect(depositoDespues.id_cliente).toBe(cliente.id);

        const cantidadesDespues = (
            await db.select().from(depositoLibrosTable).where(eq(depositoLibrosTable.deposito_id, deposito.id))
        ).map((fila) => `${fila.id_libro}:${fila.cantidad}`);
        expect(cantidadesDespues).toEqual(cantidadesAntes);

        // ...y sigue fuera del listado de depósitos del usuario.
        const listado = await auth(request(app).get('/deposito/'));
        expect(listado.body.data.map((d: { id: number }) => d.id)).not.toContain(deposito.id);

        // El movimiento histórico sigue mostrando el nombre del cliente.
        const detalle = await auth(request(app).get(`/movimiento/${movimientosCreados[1]}`));
        expect(detalle.body.data.cliente).toEqual({ id: cliente.id, nombre: cliente.nombre });
    });
});
