import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { container } from '../src/container';
import { db } from '../src/db/client';
import { expectCreated } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { usersTable } from '../src/modules/user/user.schema';
import { librosTable } from '../src/modules/libro/libro.schema';
import { ordersTable } from '../src/modules/tienda/order/order.schema';
import { orderItemsTable } from '../src/modules/tienda/order/orderItem.schema';
import { reservationsTable } from '../src/modules/tienda/stock/reservation.schema';
import { orderHistoryTable } from '../src/modules/tienda/order/orderHistory.schema';
import { paymentsTable, webhookEventsTable } from '../src/modules/tienda/payment/payment.schema';
import { shipmentsTable, shipmentEventsTable } from '../src/modules/tienda/shipping/shipping.schema';

let tokenA: string;
let tokenB: string;
let userA: number;
let userB: number;
let integracionA: number;
let integracionA2: number;
let integracionB: number;

const login = async (username: string) =>
    (await request(app).post('/user/login').send({ username, password: PASSWORD_SEED })).body.token;

const crearIntegracion = async (nombre: string, origen: string, token: string) => {
    const res = await request(app)
        .post('/integraciones')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre, origen });
    expectCreated(res);
    return res.body.data.integracion.id as number;
};

const getId = async (username: string) => {
    const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, username));
    return user.id;
};

const pedido = (user: number, integracion: number, overrides: Record<string, unknown> = {}) => ({
    user,
    integracion_id: integracion,
    codigo: `PED-MODELO-${randomUUID()}`.slice(0, 30),
    referencia_externa: randomUUID(),
    clave_idempotencia: randomUUID(),
    comprador_nombre: 'Comprador modelo',
    comprador_email: 'modelo@test.com',
    comprador_telefono: '1122334455',
    comprador_documento: '20123456',
    entrega_tipo: 'envio' as const,
    entrega_calle: 'Av. Siempre Viva',
    entrega_numero: '123',
    entrega_piso: '1',
    entrega_localidad: 'CABA',
    entrega_provincia: 'Ciudad Autónoma de Buenos Aires',
    entrega_codigo_postal: '1425',
    peso_kg: 0.45,
    subtotal: 12500,
    costo_envio: 3200,
    total: 15700,
    ...overrides
});

const insertarPedido = async (user: number, integracion: number, overrides: Record<string, unknown> = {}) => {
    const [row] = await db.insert(ordersTable).values(pedido(user, integracion, overrides) as never).returning();
    return row;
};

beforeAll(async () => {
    tokenA = await login('libreria_sur');
    tokenB = await login('editorial_norte');
    userA = await getId('libreria_sur');
    userB = await getId('editorial_norte');

    integracionA = await crearIntegracion('Modelo A', 'https://modelo-a.test', tokenA);
    integracionA2 = await crearIntegracion('Modelo A 2', 'https://modelo-a2.test', tokenA);
    integracionB = await crearIntegracion('Modelo B', 'https://modelo-b.test', tokenB);
});

afterAll(() => {
    db.$client.end();
    server.close();
});

describe('Modelo de tienda', () => {
    it('persiste pedido, ítems, reserva, pago, envío e historial', async () => {
        const [libro] = await db
            .select({ id_libro: librosTable.id_libro, isbn: librosTable.isbn, titulo: librosTable.titulo })
            .from(librosTable)
            .where(eq(librosTable.user, userA))
            .limit(1);
        const deposito = await container.deposito.repository.findPrincipal(userA);

        const pedidoRow = await insertarPedido(userA, integracionA);
        expect(pedidoRow).toMatchObject({
            user: userA,
            integracion_id: integracionA,
            estado: 'pendiente_pago',
            estado_pago: 'pendiente',
            moneda: 'ARS',
            peso_kg: 0.45,
            subtotal: 12500,
            costo_envio: 3200,
            total: 15700
        });

        const [item] = await db
            .insert(orderItemsTable)
            .values({
                user: userA,
                pedido_id: pedidoRow.id,
                isbn: libro.isbn,
                titulo: libro.titulo,
                precio_unitario: 12500,
                cantidad: 1,
                subtotal: 12500
            })
            .returning();
        expect(item).toMatchObject({ isbn: libro.isbn, cantidad: 1, subtotal: 12500 });

        const [reserva] = await db
            .insert(reservationsTable)
            .values({
                user: userA,
                pedido_id: pedidoRow.id,
                id_libro: libro.id_libro,
                deposito_id: deposito.id,
                cantidad: 1,
                expira_en: new Date(Date.now() + 30 * 60 * 1000)
            })
            .returning();
        expect(reserva).toMatchObject({ cantidad: 1, estado: 'activa', deposito_id: deposito.id });

        const [pago] = await db
            .insert(paymentsTable)
            .values({
                user: userA,
                pedido_id: pedidoRow.id,
                pago_id: `mp-${randomUUID()}`,
                preferencia_id: `pref-${randomUUID()}`,
                importe: 15700,
                moneda: 'ARS'
            })
            .returning();
        expect(pago).toMatchObject({ estado: 'pendiente', importe: 15700, moneda: 'ARS' });

        const [envio] = await db
            .insert(shipmentsTable)
            .values({
                user: userA,
                pedido_id: pedidoRow.id,
                proveedor_envio_id: `env-${randomUUID()}`,
                codigo_seguimiento: 'CA123456789',
                estado: 'en_transito',
                etiqueta_creada_en: new Date()
            })
            .returning();
        expect(envio).toMatchObject({ codigo_seguimiento: 'CA123456789', estado: 'en_transito' });

        const [evento] = await db
            .insert(shipmentEventsTable)
            .values({
                user: userA,
                envio_id: envio.id,
                evento_proveedor_id: `evt-${randomUUID()}`,
                estado: 'en_transito',
                descripcion: 'En camino'
            })
            .returning();
        expect(evento).toMatchObject({ estado: 'en_transito' });

        const [hito] = await db
            .insert(orderHistoryTable)
            .values({
                user: userA,
                pedido_id: pedidoRow.id,
                tipo: 'creado',
                descripcion: 'Pedido creado'
            })
            .returning();
        expect(hito).toMatchObject({ tipo: 'creado', descripcion: 'Pedido creado' });
    });

    it('deduplica pagos, eventos de envío y webhooks', async () => {
        const pedidoRow = await insertarPedido(userA, integracionA);
        const pagoId = `mp-${randomUUID()}`;
        const eventoId = `evt-${randomUUID()}`;
        const webhookId = `wh-${randomUUID()}`;

        await db.insert(paymentsTable).values({
            user: userA,
            pedido_id: pedidoRow.id,
            pago_id: pagoId,
            importe: 100
        });
        await expect(
            db.insert(paymentsTable).values({
                user: userA,
                pedido_id: pedidoRow.id,
                pago_id: pagoId,
                importe: 100
            })
        ).rejects.toThrow();

        const [envio] = await db
            .insert(shipmentsTable)
            .values({ user: userA, pedido_id: pedidoRow.id, proveedor_envio_id: `env-${randomUUID()}` })
            .returning();
        await db.insert(shipmentEventsTable).values({
            user: userA,
            envio_id: envio.id,
            evento_proveedor_id: eventoId,
            estado: 'en_transito'
        });
        await expect(
            db.insert(shipmentEventsTable).values({
                user: userA,
                envio_id: envio.id,
                evento_proveedor_id: eventoId,
                estado: 'entregado'
            })
        ).rejects.toThrow();

        await db.insert(webhookEventsTable).values({
            proveedor: 'mercadopago',
            evento_id: webhookId,
            tipo: 'payment'
        });
        await expect(
            db.insert(webhookEventsTable).values({
                proveedor: 'mercadopago',
                evento_id: webhookId,
                tipo: 'payment'
            })
        ).rejects.toThrow();
    });

    it('rechaza cantidades no positivas, importes negativos y estados inválidos', async () => {
        const pedidoRow = await insertarPedido(userA, integracionA);

        await expect(
            db.insert(orderItemsTable).values({
                user: userA,
                pedido_id: pedidoRow.id,
                isbn: '9780000000001',
                titulo: 'Inválido',
                precio_unitario: 100,
                cantidad: 0,
                subtotal: 0
            })
        ).rejects.toThrow();

        await expect(
            db.insert(orderItemsTable).values({
                user: userA,
                pedido_id: pedidoRow.id,
                isbn: '9780000000002',
                titulo: 'Inválido',
                precio_unitario: -1,
                cantidad: 1,
                subtotal: -1
            })
        ).rejects.toThrow();

        await expect(
            db.insert(ordersTable).values(pedido(userA, integracionA, { subtotal: -1, total: -1 }) as never)
        ).rejects.toThrow();

        await expect(
            db.insert(ordersTable).values(
                pedido(userA, integracionA, { estado: 'estado_invalido' }) as never
            )
        ).rejects.toThrow();
    });

    it('la clave de idempotencia es única por integración y la referencia externa es única', async () => {
        const clave = randomUUID();
        const referencia = randomUUID();

        await insertarPedido(userA, integracionA, { clave_idempotencia: clave, referencia_externa: referencia });

        await expect(
            insertarPedido(userA, integracionA, { clave_idempotencia: clave, referencia_externa: randomUUID() })
        ).rejects.toThrow();

        await expect(
            insertarPedido(userA, integracionA, { clave_idempotencia: randomUUID(), referencia_externa: referencia })
        ).rejects.toThrow();

        // La misma clave en otra integración es válida.
        const otro = await insertarPedido(userA, integracionA2, {
            clave_idempotencia: clave,
            referencia_externa: randomUUID()
        });
        expect(otro).toBeDefined();
    });

    it('las referencias compuestas impiden cruzar cuentas', async () => {
        const pedidoA = await insertarPedido(userA, integracionA);

        await expect(insertarPedido(userA, integracionB)).rejects.toThrow();

        await expect(
            db.insert(orderItemsTable).values({
                user: userB,
                pedido_id: pedidoA.id,
                isbn: '9780000000003',
                titulo: 'Cruzado',
                precio_unitario: 100,
                cantidad: 1,
                subtotal: 100
            })
        ).rejects.toThrow();

        const [libroB] = await db
            .select({ id_libro: librosTable.id_libro })
            .from(librosTable)
            .where(eq(librosTable.user, userB))
            .limit(1);
        const depositoA = await container.deposito.repository.findPrincipal(userA);

        await expect(
            db.insert(reservationsTable).values({
                user: userA,
                pedido_id: pedidoA.id,
                id_libro: libroB.id_libro,
                deposito_id: depositoA.id,
                cantidad: 1,
                expira_en: new Date(Date.now() + 60_000)
            })
        ).rejects.toThrow();

        const pedidoB = await insertarPedido(userB, integracionB);

        await expect(
            db.insert(paymentsTable).values({
                user: userA,
                pedido_id: pedidoB.id,
                importe: 100
            })
        ).rejects.toThrow();
    });
});
