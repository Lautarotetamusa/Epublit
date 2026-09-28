
import { test, expect, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { facturar } from "../src/lib/afip/Afip";
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';

const afipService = createMockAfipService();
const container = createContainer({ afipService, comprobanteService: createMockComprobanteService() });
const app = createApp(container);

const isbnLibro = isbn(9995);
let token: string;

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

    token = res.body.token;
});

afterAll(() => {
    db.$client.end();
});

test("Facturar", async () => {
    const user = await container.user.service.findOne({ id: 1 });
    expect(user.punto_venta).not.toBeNull();

    const resLibro = await request(app)
        .post('/libro/')
        .set('Authorization', `Bearer ${token}`)
        .send({ isbn: isbnLibro, titulo: 'Test afip', fecha_edicion: '2020-01-01', precio: 1000, stock: 5 });
    expect(resLibro.status).toBe(201);

    const resClientes = await request(app).get('/cliente?tipo=particular').set('Authorization', `Bearer ${token}`);
    const cliente = resClientes.body.items[0];

    const resVenta = await request(app)
        .post('/venta/')
        .set('Authorization', `Bearer ${token}`)
        .send({ cliente: cliente.id, medio_pago: 'efectivo', tipo_cbte: 11, libros: [{ isbn: isbnLibro, cantidad: 1 }] });
    expect(resVenta.status).toBe(201);
    const id = resVenta.body.data.id;

    const venta = await container.transaccion.ventaRepository.getById(id, user.id);
    const transaction = await container.transaccion.repository.getById(id, user.id);
    const clienteRow = await container.cliente.service.findOne({ id: transaction.id_cliente, user: user.id });

    const comprobante = await facturar(user.punto_venta || 1, venta, clienteRow, afipService.getClient(user));
    expect(comprobante).not.toBeNull();
});
