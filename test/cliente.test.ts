import {describe, expect, test, vi} from 'vitest';
import request from "supertest";
import { eq, or, inArray } from 'drizzle-orm';

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

const cuitNoExistente = "12345";

vi.mock('../src/afip/Afip', () => ({
    getAfipData: vi.fn((cuit) => {
        if (cuit == cuitNoExistente) throw new NotFound("El cuit no valido")

        return {
            ingresos_brutos: false,
            fecha_inicio: "10/02/2025",
            razon_social: "CLIENTE DE PRUEBA",
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        }
    })
}));

vi.mock('../src/comprobantes/comprobante', () => ({
    emitirComprobante: vi.fn().mockResolvedValue(undefined)
}));

// Usar la DB de testing
process.env.DB_NAME = "epublit_test";
import {app, server} from '../src/app';
import {conn} from '../src/db'
import { db } from '../src/pgDb';
import { clientesTable } from '../src/schemas/clientes.schema';
import { libroClienteTable } from '../src/schemas/libroCliente.schema';
import { precioLibroClienteTable } from '../src/schemas/precioLibroCliente.schema';
import { librosTable } from '../src/schemas/libros.schema';
import {delay, expectBadRequest, expectDataResponse, expectCreated, expectNotFound, expectErrorResponse} from './util';

import { tipoCliente } from '../src/validators/cliente.validator';
import { NotFound } from '../src/models/errors';
import { generateClientPath } from '../src/services/cliente.service';

const cuit = "30500001735"
const isbnStock = "1234567890123";
let cliente: any = {};
let token: string;

/*
    - Creamos dos clientes, una con cuit 11111111 y otra 22222222
    - Intentamos crear otra con el mismo cuit y obtenemos un error
    - Obtenemos una cliente con un id q no existe y nos da un error
    - Verificamos que la cliente creada esté en la lista
    - Intentamos actualizar el cliente 1 al cuit de la cliente 2 y obtenemos un error
    - Actualizamos la cliente
    - Intentamos borrar una cliente que no existe, obtenemos un error
    - Borramos la cliente 1
    - Verificamos que ya no esté en la lista
    - Hard delete de las dos clientes para evitar que queden en la DB.
*/

afterAll(() => {
    conn.end();
    server.close();
});

test('Hard delete', async () => {
    const existentes = await db
        .select({ id: clientesTable.id })
        .from(clientesTable)
        .where(or(eq(clientesTable.cuit, cuit), eq(clientesTable.cuit, "20434919798")));

    const ids = existentes.map((c) => c.id);
    if (ids.length > 0) {
        await db.delete(precioLibroClienteTable).where(inArray(precioLibroClienteTable.id_cliente, ids));
        await db.delete(libroClienteTable).where(inArray(libroClienteTable.id_cliente, ids));
        await db.delete(clientesTable).where(inArray(clientesTable.id, ids));
    }

    await db.delete(librosTable).where(eq(librosTable.isbn, isbnStock));
});

test('login', async () => {
    const data = {
        username: 'teti',
        password: 'Lautaro123.'
    }

    const res = await request(app)
        .post('/user/login')
        .send(data)

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.token).not.toBeUndefined();
    expect(res.body.token).not.toBeNull();
    expect(res.body.token).not.toBeFalsy();
    token = res.body.token;
});

test('file paths', () => {
    const mockDate = new Date('2025-03-08T17:58:19.090Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
    const razon_social = "LAUTARO TETA MUSA"
    const path = generateClientPath(razon_social)
    vi.useRealTimers();

    expect(path).toEqual("LAUTAROTETAMUSA-20250308-175819.pdf");
});

describe('POST cliente/', () => {
    test('Sin nombre', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        cliente.nombre = 'Test';
        cliente.email = 'test@gmail.com';

        expectBadRequest(res);
    });

    test('consumidor final', async () => {
        // El body no tiene cuit todavía en este punto (se carga en el
        // siguiente test): el 400 esperado es por falta de cuit, no por
        // `tipo` (que se ignora, ver spec "Casos borde").
        cliente.tipo = tipoCliente.particular;
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        cliente.tipo = 'inscripto';

        expectBadRequest(res);
    });

    test('Sin cuit', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        cliente.cuit = cuitNoExistente;

        expectBadRequest(res);
    });

    test('Persona no está cargada en Afip', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });


    test('Success', async () => {
        cliente.cuit = cuit;

        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        expectCreated(res);

        cliente.id = res.body.data.id;
    });

    test('cuit repetido', async () => {
        const res = await request(app)
            .post('/cliente/').send(cliente)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(404);
        expect(res.body.success).toEqual(false);
    });
});

describe('GET cliente/', () => {
    test('cliente que no existe', async () => {
        const res = await request(app)
            .get('/cliente/999999999')
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    test('Obtener cliente', async () => {
        const res = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body).toMatchObject(cliente);
    });

    test('Obtener clientes de un tipo', async () => {
        const res = await request(app)
            .get('/cliente?tipo=inscripto')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        for (const c of res.body){
            expect(c.tipo).toBe("inscripto")
        }
    });

    test('La cliente está en la lista', async () => {
        const res = await request(app)
            .get('/cliente/')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.map((p: any) => p.id)).toContain(cliente.id);
    });

    test('Obtener ventas de un cliente responde 501 (no migrado)', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/ventas`)
            .set('Authorization', `Bearer ${token}`);

        expectErrorResponse(res, 501);
    });
});

describe('Stock cliente', () => {
    let idLibroStock: number;
    let precioInicial: number;

    test('Preparar libro para el stock del cliente', async () => {
        const res = await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send({
                isbn: isbnStock,
                titulo: 'Test stock cliente',
                fecha_edicion: '2020-01-01',
                precio: 100,
                stock: 10
            });

        expectCreated(res);
        idLibroStock = res.body.data.id_libro;
        precioInicial = res.body.data.precio;
    });

    test('El cliente no tiene stock', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body).toHaveProperty('length');
        expect(res.body.length).toBe(0);
    });

    // No hay ningún flujo migrado que cargue `libro_cliente`/
    // `precio_libro_cliente` todavía (addStock/reduceStock quedan
    // `NotImplemented` hasta que venta/transaccion migren, ver
    // specs/004-migrar-cliente/plan.md "Compatibilidad con módulos no
    // migrados"): se inserta directo en Postgres para poder ejercitar
    // GET/PUT /cliente/:id/stock.
    test('Cargamos stock directamente en Postgres', async () => {
        await db.insert(libroClienteTable).values({
            id_cliente: cliente.id,
            id_libro: idLibroStock,
            isbn: isbnStock,
            stock: 3,
            precio: precioInicial
        });
        await db.insert(precioLibroClienteTable).values({
            id_cliente: cliente.id,
            id_libro: idLibroStock,
            precio: precioInicial
        });
    });

    test('El cliente tiene el stock cargado', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock/`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toEqual(200);

        const libro = res.body.find((l: any) => l.isbn == isbnStock);
        expect(libro).not.toBeUndefined();
        expect(libro.stock).toEqual(3);
        expect(libro.precio).toEqual(precioInicial);
    });

    let updateTime: string;
    let nuevoPrecio: number;
    test('Se actualiza el precio del cliente', async () => {
        nuevoPrecio = precioInicial + 100;

        const resLibro = await request(app)
            .put(`/libro/${isbnStock}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ precio: nuevoPrecio });

        expectDataResponse(resLibro, 201);
        updateTime = new Date().toISOString();
        await delay(1500);  // Esperamos para que haya dos fechas de actualizacion distintas

        const res = await request(app)
            .put(`/cliente/${cliente.id}/stock/`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.success).toEqual(true);
    });

    test('Precio actualizado correctamente', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock/`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toEqual(200);

        const libro = res.body.find((l: any) => l.isbn == isbnStock);
        expect(libro.stock).toEqual(3);
        expect(libro.precio).toEqual(nuevoPrecio);
    });

    test('Precio anterior a la fecha de actualizacion', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}/stock?fecha=${updateTime}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toEqual(200);

        const libro = res.body.find((l: any) => l.isbn == isbnStock);
        expect(libro).not.toBeUndefined();
        expect(libro.stock).toEqual(3);
        expect(libro.precio).toEqual(precioInicial);
    });

    test('Sincronizar sin cambios responde 200 igual', async () => {
        const res = await request(app)
            .put(`/cliente/${cliente.id}/stock/`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.success).toEqual(true);
    });
});

describe('PUT cliente/{id}', () => {
    test('Nothing changed', async () => {
        delete cliente.cuit;
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect(res.status).toEqual(201);
    });

    test('Actualizar nombre y email', async () => {
        cliente.nombre = 'Test nro 2';

        const req = Object.assign({}, cliente);

        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(req);

        expectCreated(res);
        expect(res.body.data.nombre).toEqual(cliente.nombre);

        const res1 = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res1.status).toEqual(200);
        expect(res1.body).toMatchObject(cliente);
    });

    test('Actualizar a un cuit que no esta en afip', async () => {
        cliente.cuit = cuitNoExistente;
        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expectNotFound(res);
    });

    test('Actualizar a un cuit que ya esta cargado', async () => {
        let res = await request(app)
            .get('/cliente/')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);

        cliente.cuit = '20434919798';

        // Se carga otro cliente con ese cuit para poder chequear el duplicado.
        const otro = await request(app)
            .post('/cliente/')
            .set('Authorization', `Bearer ${token}`)
            .send({ nombre: 'Otro', cuit: cliente.cuit });
        expectCreated(otro);

        res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        expect(res.status).toEqual(404);
        expect(res.body.errors[0].message).toEqual(`El cliente con cuit ${cliente.cuit} ya existe`);

        // Limpiamos el cliente auxiliar creado para el chequeo de duplicado.
        await db.delete(clientesTable).where(eq(clientesTable.id, otro.body.data.id));
    });

    test('Actualizar el cuit', async () => {
        cliente.cuit = cuit;
        cliente.este_campo_no_va = "anashe23";

        const res = await request(app)
            .put('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`)
            .send(cliente);

        cliente = res.body.data;

        expectCreated(res);

        const res2 = await request(app)
            .get('/cliente/'+cliente.id)
            .set('Authorization', `Bearer ${token}`);

        expect(res2.status).toEqual(200);

        delete cliente.tipo;
        expect(res2.body).toMatchObject(cliente);
    });
});

describe('DELETE /cliente/{id}', () => {
    test('Cliente que no existe', async () => {
        const res = await request(app)
            .delete('/cliente/999999999')
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    test('No se puede eliminar el CONSUMIDOR FINAL', async () => {
        const res1 = await request(app)
            .get('/cliente?tipo=particular')
            .set('Authorization', `Bearer ${token}`);
        expect(res1.status).toEqual(200);
        const consumidorFinal = res1.body[0];

        const res = await request(app)
            .delete(`/cliente/${consumidorFinal.id}`)
            .set('Authorization', `Bearer ${token}`);

        expectBadRequest(res);
    });

    test('No se puede eliminar el MOSTRADOR', async () => {
        const res1 = await request(app)
            .get('/cliente?tipo=negro')
            .set('Authorization', `Bearer ${token}`);
        expect(res1.status).toEqual(200);
        const mostrador = res1.body[0];

        const res = await request(app)
            .delete(`/cliente/${mostrador.id}`)
            .set('Authorization', `Bearer ${token}`);

        expectBadRequest(res);
    });

    test('Elimina un cliente inscripto propio', async () => {
        const res = await request(app)
            .delete(`/cliente/${cliente.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
    });

    test('El cliente eliminado ya no existe', async () => {
        const res = await request(app)
            .get(`/cliente/${cliente.id}`)
            .set('Authorization', `Bearer ${token}`);

        expectNotFound(res);
    });

    test('El cliente eliminado ya no está en la lista', async () => {
        const res = await request(app)
            .get('/cliente/')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.map((p: any) => p.id)).not.toContain(cliente.id);
    });
});
