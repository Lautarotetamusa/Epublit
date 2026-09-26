import { describe, expect, test, vi, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

const cuitNoExistente = "12345";

vi.mock('../src/lib/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { NotFound } from 'bradb';
import { expectBadRequest, expectConflict, expectCreated, expectUpdated, expectNotFound, expectErrorResponse, expectList } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { cuit, isbn } from '../seeders/data';
import { generateClientPath } from '../src/modules/cliente';

// `getAfipData` propio de este archivo: tira `NotFound` para el cuit de
// prueba que simula "no está cargado en AFIP", igual que el resto responde
// con datos fijos (vía DI, no `vi.mock`).
const afipService = createMockAfipService({
    getAfipData: async (cuitConsultado) => {
        if (cuitConsultado === cuitNoExistente) throw new NotFound("El cuit no valido");

        return {
            ingresos_brutos: false,
            fecha_inicio: "10/02/2025",
            razon_social: "CLIENTE DE PRUEBA",
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        };
    }
});
const container = createContainer({ afipService });
const app = createApp(container);

// Recipe fija de `seeders/clientes.seeder.ts`: 3 clientes "inscripto" por
// usuario, cuit(100 + índice global). `libreria_sur` es el primer usuario
// seedeado, así que sus 3 inscriptos son cuit(100), cuit(101), cuit(102).
const CUIT_INSCRIPTO_1 = cuit(100);
const CUIT_INSCRIPTO_2 = cuit(101);

// `seeders/libroCliente.seeder.ts`: el primer inscripto de cada usuario
// queda con los primeros 4 libros de ese usuario en consignación, stock 10
// cada uno. `libreria_sur` es el primer usuario, así que sus libros son
// isbn(0)..isbn(11) y el inscripto 1 consigna isbn(0)..isbn(3).
const ISBN_EN_CONSIGNACION = isbn(0);

let token: string;

async function getClientePorCuit(cuit: string) {
    const res = await request(app)
        .get('/cliente?tipo=inscripto')
        .set('Authorization', `Bearer ${token}`);

    return res.body.items.find((c: { cuit: string }) => c.cuit === cuit);
}

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });

    token = res.body.token;
});

afterAll(() => {
    db.$client.end();
});

describe('generateClientPath', () => {
    test('arma el nombre del archivo a partir de la razón social y la fecha', () => {
        const mockDate = new Date('2025-03-08T17:58:19.090Z');
        vi.useFakeTimers();
        vi.setSystemTime(mockDate);

        const path = generateClientPath("LAUTARO TETA MUSA");

        vi.useRealTimers();
        expect(path).toEqual("LAUTAROTETAMUSA-20250308-175819.pdf");
    });
});

describe('GET /cliente', () => {
    test('lista paginada', async () => {
        const res = await request(app)
            .get('/cliente')
            .set('Authorization', `Bearer ${token}`);

        expectList(res);
    });

    test('filtra por tipo', async () => {
        const res = await request(app)
            .get('/cliente?tipo=inscripto')
            .set('Authorization', `Bearer ${token}`);

        expectList(res);
        expect(res.body.items.length).toBeGreaterThan(0);
        for (const c of res.body.items) {
            expect(c.tipo).toBe("inscripto");
        }
    });

    test('incluye los clientes por defecto (CONSUMIDOR FINAL, MOSTRADOR)', async () => {
        const res = await request(app)
            .get('/cliente')
            .set('Authorization', `Bearer ${token}`);

        const tipos = res.body.items.map((c: { tipo: string }) => c.tipo);
        expect(tipos).toContain("particular");
        expect(tipos).toContain("negro");
    });
});

describe('GET /cliente/:id', () => {
    test('cliente que no existe', async () => {
        const res = await request(app)
            .get('/cliente/999999999')
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    test('devuelve un cliente propio', async () => {
        const cliente = await getClientePorCuit(CUIT_INSCRIPTO_1);

        const res = await request(app)
            .get(`/cliente/${cliente.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.data.cuit).toEqual(CUIT_INSCRIPTO_1);
    });
});

describe('POST /cliente', () => {
    test('sin nombre', async () => {
        const res = await request(app)
            .post('/cliente/')
            .set('Authorization', `Bearer ${token}`)
            .send({ cuit: cuitNoExistente });

        expectBadRequest(res);
    });

    test('cuit repetido con un cliente propio existente', async () => {
        const res = await request(app)
            .post('/cliente/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Cliente nuevo', cuit: CUIT_INSCRIPTO_1 });

        expectConflict(res);
    });

    test('persona no está cargada en AFIP', async () => {
        const res = await request(app)
            .post('/cliente/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Cliente nuevo', cuit: cuitNoExistente });

        expectNotFound(res);
    });

    test('creación exitosa', async () => {
        const res = await request(app)
            .post('/cliente/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Cliente de prueba POST', cuit: cuit(9999) });

        expectCreated(res);
        expect(res.body.data.tipo).toEqual("inscripto");
    });
});

describe('PUT /cliente/:id', () => {
    test('body vacío es 400 (bradb exige al menos un campo)', async () => {
        const cliente = await getClientePorCuit(CUIT_INSCRIPTO_2);

        const res = await request(app)
            .put(`/cliente/${cliente.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expectBadRequest(res);
    });

    test('actualiza nombre y email', async () => {
        const cliente = await getClientePorCuit(CUIT_INSCRIPTO_2);

        const res = await request(app)
            .put(`/cliente/${cliente.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Nombre actualizado', email: 'actualizado@epublit.test' });

        expectUpdated(res);
        expect(res.body.data.nombre).toEqual('Nombre actualizado');
    });

    test('no se puede actualizar el CONSUMIDOR FINAL', async () => {
        const consumidorFinal = await getClientePorTipo("particular");

        const res = await request(app)
            .put(`/cliente/${consumidorFinal.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Otro nombre' });

        expectBadRequest(res);
    });
});

describe('DELETE /cliente/:id', () => {
    test('cliente que no existe', async () => {
        const res = await request(app)
            .delete('/cliente/999999999')
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    test('no se puede eliminar el CONSUMIDOR FINAL', async () => {
        const consumidorFinal = await getClientePorTipo("particular");

        const res = await request(app)
            .delete(`/cliente/${consumidorFinal.id}`)
            .set('Authorization', `Bearer ${token}`);

        expectBadRequest(res);
    });

    test('no se puede eliminar el MOSTRADOR', async () => {
        const mostrador = await getClientePorTipo("negro");

        const res = await request(app)
            .delete(`/cliente/${mostrador.id}`)
            .set('Authorization', `Bearer ${token}`);

        expectBadRequest(res);
    });

    test('elimina un cliente inscripto propio y ya no aparece', async () => {
        // Crea su propio cliente descartable en vez de tocar uno seedeado:
        // el DELETE es lo que se está probando, no hace falta que sobreviva.
        const creado = await request(app)
            .post('/cliente/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'A eliminar', cuit: cuit(9998) });
        expectCreated(creado);

        const res = await request(app)
            .delete(`/cliente/${creado.body.data.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);

        const getRes = await request(app)
            .get(`/cliente/${creado.body.data.id}`)
            .set('Authorization', `Bearer ${token}`);
        expectNotFound(getRes);
    });
});

describe('Stock de cliente', () => {
    test('devuelve el stock en consignación (dato seedeado)', async () => {
        const cliente = await getClientePorCuit(CUIT_INSCRIPTO_1);

        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        const libro = res.body.data.find((l: { isbn: string }) => l.isbn === ISBN_EN_CONSIGNACION);
        expect(libro).toBeDefined();
        expect(libro.stock).toEqual(10);
    });
});

describe('GET /cliente/:id/ventas', () => {
    test('responde 501 (no migrado)', async () => {
        const cliente = await getClientePorCuit(CUIT_INSCRIPTO_1);

        const res = await request(app)
            .get(`/cliente/${cliente.id}/ventas`)
            .set('Authorization', `Bearer ${token}`);

        expectErrorResponse(res, 501);
    });
});

async function getClientePorTipo(tipo: string) {
    const res = await request(app)
        .get(`/cliente?tipo=${tipo}`)
        .set('Authorization', `Bearer ${token}`);

    return res.body.items[0];
}
