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
import { expectCreated, expectConflict, cargarStockPrincipal, getMedioPagoId } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';
import { usersTable } from '../src/modules/user/user.schema';
import { ordersTable } from '../src/modules/tienda/order/order.schema';
import { reservationsTable } from '../src/modules/tienda/stock/reservation.schema';

const ORIGEN = 'https://tienda-stock.test';

let token: string;
let userId: number;
let integracionId: number;
let apiKey: string;

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

const crearLibro = async (numero: number, limite: number) => {
    const res = await auth(
        request(app).post('/libro/').send({
            isbn: isbn(numero),
            titulo: `Libro stock ${numero}`,
            fecha_edicion: '2020-02-17',
            precio: 1000,
            stock_negativo_permitido: limite
        })
    );
    expectCreated(res);
    return res.body.data as { id_libro: number; isbn: string; titulo: string };
};

const crearPedido = async () => {
    const [pedido] = await db
        .insert(ordersTable)
        .values({
            user: userId,
            integracion_id: integracionId,
            codigo: `PED-TEST-${randomUUID().slice(0, 12)}`,
            referencia_externa: randomUUID(),
            clave_idempotencia: randomUUID(),
            comprador_nombre: 'Comprador test',
            comprador_email: 'comprador@test.com',
            entrega_tipo: 'retiro',
            subtotal: 0,
            total: 0
        })
        .returning();

    return pedido.id;
};

const item = (libro: { id_libro: number; isbn: string; titulo: string }, cantidad: number) => ({
    id_libro: libro.id_libro,
    isbn: libro.isbn,
    titulo: libro.titulo,
    cantidad
});

const reservar = async (libro: { id_libro: number; isbn: string; titulo: string }, cantidad: number) => {
    const pedidoId = await crearPedido();
    const expiraEn = new Date(Date.now() + 30 * 60 * 1000);
    return container.tienda.availabilityService.reserve(pedidoId, [item(libro, cantidad)], userId, expiraEn);
};

const disponibilidad = (libro: { id_libro: number; isbn: string; titulo: string }, cantidad = 1) =>
    container.tienda.availabilityService.getAvailability([item(libro, cantidad)], userId);

beforeAll(async () => {
    const login = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });
    token = login.body.token;

    const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, 'libreria_sur'));
    userId = user.id;

    const integracion = await auth(
        request(app).post('/integraciones').send({ nombre: 'Stock', origen: ORIGEN })
    );
    expectCreated(integracion);
    integracionId = integracion.body.data.integracion.id;
    apiKey = integracion.body.data.apiKey;
});

afterAll(() => {
    db.$client.end();
    server.close();
});

describe('Disponibilidad con reservas', () => {
    it('la reserva activa descuenta, liberar restaura y convertir no descuenta dos veces', async () => {
        const libro = await crearLibro(9200, 0);
        await cargarStockPrincipal(app, token, libro.isbn, 5);

        const inicial = await disponibilidad(libro);
        expect(inicial[0]).toMatchObject({ fisico: 5, reservado: 0, disponible: 5, disponibleParaVenta: 5 });

        const pedidoId = await crearPedido();
        await container.tienda.availabilityService.reserve(
            pedidoId,
            [item(libro, 2)],
            userId,
            new Date(Date.now() + 30 * 60 * 1000)
        );

        const conReserva = await disponibilidad(libro);
        expect(conReserva[0]).toMatchObject({ fisico: 5, reservado: 2, disponible: 3, disponibleParaVenta: 3 });

        const admin = await auth(request(app).get(`/libro/${libro.isbn}`));
        expect(admin.body.data.disponible_principal).toBe(3);

        const publica = await request(app)
            .get(`/public/tienda/v1/libros/${libro.isbn}`)
            .set('X-API-Key', apiKey)
            .set('Origin', ORIGEN);
        expect(publica.body.disponibleParaVenta).toBe(3);

        await container.tienda.availabilityService.release(pedidoId, userId);
        const liberada = await disponibilidad(libro);
        expect(liberada[0]).toMatchObject({ disponible: 5, disponibleParaVenta: 5 });

        const pedidoConvertido = await crearPedido();
        await container.tienda.availabilityService.reserve(
            pedidoConvertido,
            [item(libro, 2)],
            userId,
            new Date(Date.now() + 30 * 60 * 1000)
        );
        await container.tienda.availabilityService.convert(pedidoConvertido, userId);

        const convertida = await disponibilidad(libro);
        expect(convertida[0]).toMatchObject({ reservado: 0, disponible: 5, disponibleParaVenta: 5 });
    });

    it('con límite 0 y disponibilidad 0 rechaza una unidad sin modificar stock', async () => {
        const libro = await crearLibro(9201, 0);

        await expect(reservar(libro, 1)).rejects.toMatchObject({ status: 409, name: 'StockInsuficiente' });

        const actual = await disponibilidad(libro);
        expect(actual[0]).toMatchObject({ fisico: 0, reservado: 0, disponible: 0, disponibleParaVenta: 0 });

        const filas = await db.select().from(reservationsTable).where(eq(reservationsTable.user, userId));
        const delLibro = filas.filter((fila) => fila.id_libro === libro.id_libro);
        expect(delLibro).toHaveLength(0);
    });

    it('con límite 2 y disponibilidad 0 permite reservar 2 y deja el disponible en -2', async () => {
        const libro = await crearLibro(9202, 2);

        const publicaAntes = await request(app)
            .get(`/public/tienda/v1/libros/${libro.isbn}`)
            .set('X-API-Key', apiKey)
            .set('Origin', ORIGEN);
        expect(publicaAntes.body).toMatchObject({ disponibleParaVenta: 2, enStock: true });

        await reservar(libro, 2);

        const actual = await disponibilidad(libro);
        expect(actual[0]).toMatchObject({ fisico: 0, reservado: 2, disponible: -2, disponibleParaVenta: 0 });

        const publicaDespues = await request(app)
            .get(`/public/tienda/v1/libros/${libro.isbn}`)
            .set('X-API-Key', apiKey)
            .set('Origin', ORIGEN);
        expect(publicaDespues.body).toMatchObject({ disponibleParaVenta: 0, enStock: false });

        await expect(reservar(libro, 1)).rejects.toMatchObject({ status: 409, name: 'StockInsuficiente' });
    });

    it('dos reservas concurrentes por el último ejemplar: una gana y la otra recibe 409', async () => {
        const libro = await crearLibro(9203, 0);
        await cargarStockPrincipal(app, token, libro.isbn, 1);

        const [primera, segunda] = await Promise.allSettled([reservar(libro, 1), reservar(libro, 1)]);

        const estados = [primera.status, segunda.status].sort();
        expect(estados).toEqual(['fulfilled', 'rejected']);

        const rechazada = [primera, segunda].find((res) => res.status === 'rejected');
        expect((rechazada as PromiseRejectedResult).reason).toMatchObject({ status: 409 });

        const actual = await disponibilidad(libro);
        expect(actual[0]).toMatchObject({ fisico: 1, reservado: 1, disponible: 0, disponibleParaVenta: 0 });
    });
});

describe('Límite negativo en ventas internas', () => {
    it('la venta de mostrador usa la misma disponibilidad y el mismo límite', async () => {
        const libro = await crearLibro(9204, 2);
        const ventaQty = 2;

        const clientes = await auth(request(app).get('/cliente?tipo=negro'));
        const cliente = clientes.body.items[0];
        const medioPago = await getMedioPagoId(app, token, 'efectivo');

        const venta = await auth(
            request(app).post('/venta/').send({
                cliente: cliente.id,
                medio_pago: medioPago,
                tipo_cbte: 11,
                libros: [{ isbn: libro.isbn, cantidad: ventaQty }]
            })
        );
        expectCreated(venta);

        const ficha = await auth(request(app).get(`/libro/${libro.isbn}`));
        expect(ficha.body.data.disponible_principal).toBe(-2);
        expect(ficha.body.data.stock).toBe(-2);

        const otroLibro = await crearLibro(9205, 2);
        const rechazada = await auth(
            request(app).post('/venta/').send({
                cliente: cliente.id,
                medio_pago: medioPago,
                tipo_cbte: 11,
                libros: [{ isbn: otroLibro.isbn, cantidad: 3 }]
            })
        );
        expectConflict(rechazada);
        expect(rechazada.body.errors[0].code).toBe('StockInsuficiente');

        const sinTocar = await disponibilidad(otroLibro);
        expect(sinTocar[0]).toMatchObject({ fisico: 0, disponible: 0 });
    });

    it('el stock consignado en clientes no cubre el faltante del principal', async () => {
        const libro = await crearLibro(9206, 0);
        await cargarStockPrincipal(app, token, libro.isbn, 5);

        const clientes = await auth(request(app).get('/cliente?tipo=inscripto'));
        const cliente = clientes.body.items[0];

        // Mueve el stock al depósito propio del cliente sin emitir remito: acá
        // sólo interesa que ese stock consignado no cubra el principal.
        const depositoPrincipal = await container.deposito.repository.findPrincipal(userId);
        const depositoCliente = await container.deposito.repository.findClienteDeposito(cliente.id, userId);
        await container.deposito.repository.moveStock(depositoPrincipal.id, libro.id_libro, userId, -5);
        await container.deposito.repository.moveStock(depositoCliente.id, libro.id_libro, userId, 5);

        const principal = await disponibilidad(libro);
        expect(principal[0]).toMatchObject({ fisico: 0, disponible: 0, disponibleParaVenta: 0 });

        const clientesNegro = await auth(request(app).get('/cliente?tipo=negro'));
        const medioPago = await getMedioPagoId(app, token, 'efectivo');
        const venta = await auth(
            request(app).post('/venta/').send({
                cliente: clientesNegro.body.items[0].id,
                medio_pago: medioPago,
                tipo_cbte: 11,
                libros: [{ isbn: libro.isbn, cantidad: 1 }]
            })
        );
        expectConflict(venta);
        expect(venta.body.errors[0].code).toBe('StockInsuficiente');
    });
});
