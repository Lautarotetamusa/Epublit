import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectBadRequest, expectCreated, expectUpdated } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';

let token: string;

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

const crearLibro = (numero: number, extra: Record<string, unknown> = {}) =>
    auth(request(app).post('/libro/').send({
        isbn: isbn(numero),
        titulo: `Libro tienda ${numero}`,
        fecha_edicion: '2020-02-17',
        precio: 10000,
        ...extra
    }));

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

    token = res.body.token;
});

afterAll(() => {
    db.$client.end();
    server.close();
});

describe('Libro: stock negativo permitido y peso', () => {
    it('sin límite ni peso quedan en 0 y null', async () => {
        const res = await crearLibro(9001);

        expectCreated(res);
        expect(res.body.data.stock_negativo_permitido).toBe(0);
        expect(res.body.data.peso_kg).toBeNull();
    });

    it('persiste el límite y el peso de la ficha', async () => {
        const res = await crearLibro(9002, { stock_negativo_permitido: 5, peso_kg: 0.45 });

        expectCreated(res);
        expect(res.body.data.stock_negativo_permitido).toBe(5);
        expect(res.body.data.peso_kg).toBeCloseTo(0.45, 3);

        const ficha = await auth(request(app).get(`/libro/${isbn(9002)}`));
        expect(ficha.body.data.stock_negativo_permitido).toBe(5);
        expect(ficha.body.data.peso_kg).toBeCloseTo(0.45, 3);
    });

    it('redondea el peso a gramos', async () => {
        const res = await crearLibro(9003, { peso_kg: 0.4504 });

        expectCreated(res);
        expect(res.body.data.peso_kg).toBeCloseTo(0.45, 3);
    });

    it('editar otros campos no pisa el límite ni el peso', async () => {
        const res = await auth(
            request(app)
                .put(`/libro/${isbn(9002)}`)
                .send({ titulo: 'Título actualizado' })
        );

        expectUpdated(res);
        expect(res.body.data.stock_negativo_permitido).toBe(5);
        expect(res.body.data.peso_kg).toBeCloseTo(0.45, 3);
    });

    it.each([
        ['negativo', -1],
        ['decimal', 1.5],
        ['texto', '5'],
        ['fuera de rango', 2147483648]
    ])('rechaza un límite %s', async (_caso, valor) => {
        const res = await crearLibro(9004, { stock_negativo_permitido: valor });

        expectBadRequest(res);
    });

    it.each([
        ['cero', 0],
        ['negativo', -0.5],
        ['texto', '0.45']
    ])('rechaza un peso %s', async (_caso, valor) => {
        const res = await crearLibro(9005, { peso_kg: valor });

        expectBadRequest(res);
    });

    it('un valor nulo de peso limpia el campo al editar', async () => {
        const res = await auth(
            request(app)
                .put(`/libro/${isbn(9002)}`)
                .send({ peso_kg: null })
        );

        expectUpdated(res);
        expect(res.body.data.peso_kg).toBeNull();
        expect(res.body.data.stock_negativo_permitido).toBe(5);
    });
});
