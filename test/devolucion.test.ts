import { describe, expect, test, vi, beforeAll, afterAll } from 'vitest';
import request from "supertest";

vi.mock('../src/lib/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { expectBadRequest } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { cuit, isbn } from '../seeders/data';

// `devolucion` nunca llama a AFIP ni genera comprobante (`generarComprobante:
// null` en operacion.config.ts): el mock de afip acá es sólo para poder
// armar el container, no se ejercita en ningún test de este archivo.
const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

// Recipe fija de `seeders/libroCliente.seeder.ts`: el primer inscripto de
// `libreria_sur` (cuit(100)) tiene isbn(0)..isbn(3) en consignación, stock 10
// cada uno.
const CUIT_INSCRIPTO = cuit(100);
const ISBN_EN_CONSIGNACION = isbn(0);

let token: string;
let clienteInscripto: { id: number; tipo: string };
let clienteNegro: { id: number; tipo: string };
let stockGeneralInicial: number;

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });
    token = res.body.token;

    const resClientes = await request(app).get('/cliente?tipo=inscripto&pageSize=100').set('Authorization', `Bearer ${token}`);
    clienteInscripto = resClientes.body.items.find((c: { cuit: string }) => c.cuit === CUIT_INSCRIPTO);

    const resNegro = await request(app).get('/cliente?tipo=negro').set('Authorization', `Bearer ${token}`);
    clienteNegro = resNegro.body.items[0];

    const resLibro = await request(app).get(`/libro/${ISBN_EN_CONSIGNACION}`).set('Authorization', `Bearer ${token}`);
    stockGeneralInicial = resLibro.body.data.stock;
});

afterAll(() => {
    db.$client.end();
});

describe('POST /devolucion', () => {
    test('no se puede devolver a un cliente no inscripto', async () => {
        const res = await request(app)
            .post('/devolucion/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cliente: clienteNegro.id, libros: [{ isbn: ISBN_EN_CONSIGNACION, cantidad: 1 }] });

        expectBadRequest(res);
    });

    test('sin stock suficiente en el cliente', async () => {
        const res = await request(app)
            .post('/devolucion/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cliente: clienteInscripto.id, libros: [{ isbn: ISBN_EN_CONSIGNACION, cantidad: 999 }] });

        expectBadRequest(res);
    });

    test('devolución exitosa: reduce el stock del cliente y aumenta el stock general', async () => {
        const res = await request(app)
            .post('/devolucion/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cliente: clienteInscripto.id, libros: [{ isbn: ISBN_EN_CONSIGNACION, cantidad: 2 }] });

        expect(res.status).toBe(201);
        expect(res.body.data.type).toEqual('devolucion');
        // Nunca genera archivo (ver operacion.config.ts).
        expect(res.body.data.file_path).toEqual('');

        const resStock = await request(app)
            .get(`/cliente/${clienteInscripto.id}/stock`)
            .set('Authorization', `Bearer ${token}`);
        const libroCliente = resStock.body.data.find((l: { isbn: string }) => l.isbn === ISBN_EN_CONSIGNACION);
        expect(libroCliente.stock).toEqual(8);

        const resLibro = await request(app)
            .get(`/libro/${ISBN_EN_CONSIGNACION}`)
            .set('Authorization', `Bearer ${token}`);
        expect(resLibro.body.data.stock).toEqual(stockGeneralInicial + 2);
    });

    test('GET /devolucion lista la devolución propia', async () => {
        const res = await request(app)
            .get('/devolucion')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        for (const d of res.body.data) {
            expect(d.type).toEqual('devolucion');
        }
    });
});
