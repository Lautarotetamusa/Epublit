import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { isbn } from '../seeders/data';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectBadRequest, expectCreated, expectNotFound, expectUpdated } from './util';
import { depositosTable } from '../src/modules/deposito/deposito.schema';
import { depositoLibrosTable } from '../src/modules/deposito/depositoLibros.schema';
import { movimientosTable } from '../src/modules/movimiento/movimiento.schema';
import { clientesTable } from '../src/modules/cliente/cliente.schema';

const container = createContainer({
    afipService: createMockAfipService()
});
const app = createApp(container);

let token: string;
let otroToken: string;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

function crearDeposito(nombre: string, descripcion?: string | null, t = token) {
    const body = descripcion === undefined ? { nombre } : { nombre, descripcion };

    return auth(request(app).post('/deposito/').send(body), t);
}

function crearLibro(isbnLibro: string, titulo: string, t = token) {
    return auth(
        request(app).post('/libro/').send({
            isbn: isbnLibro,
            titulo,
            fecha_edicion: '2020-01-01',
            precio: 1000
        }),
        t
    );
}

async function ingreso(depositoId: number, libros: { isbn: string; cantidad: number }[], t = token) {
    return auth(
        request(app).post('/movimiento/').send({
            origen: { tipo: 'exterior' },
            destino: { tipo: 'deposito', id: depositoId },
            libros
        }),
        t
    );
}

beforeAll(async () => {
    const [res, otroRes] = await Promise.all([
        request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED })
    ]);

    token = res.body.token;
    otroToken = otroRes.body.token;
});

afterAll(() => {
    db.$client.end();
});

describe('depósito principal de un usuario nuevo', () => {
    const username = 'deposito_nuevo';
    const cuitNuevo = '20400000011';
    const password = 'seed12345';
    let tokenNuevo: string;

    beforeAll(async () => {
        fs.rmSync(join(__dirname, '../afipkeys/', cuitNuevo), { recursive: true, force: true });

        const registro = await request(app)
            .post('/user/register')
            .send({ username, password, cuit: cuitNuevo, email: 'deposito_nuevo@test.com' });
        expectCreated(registro);

        const login = await request(app).post('/user/login').send({ username, password });
        tokenNuevo = login.body.token;
    });

    it('registrar un usuario nuevo le crea exactamente un depósito principal, vacío', async () => {
        const res = await auth(request(app).get('/deposito/'), tokenNuevo);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0]).toMatchObject({ principal: true, titulos: 0, ejemplares: 0 });
        expect(res.body.data[0].nombre).toBeTruthy();
    });

    it('el flag principal no se puede marcar al crear ni al editar', async () => {
        const crear = await auth(request(app).post('/deposito/').send({ nombre: 'Intento principal', principal: true }), tokenNuevo);
        expectBadRequest(crear);

        const [principal] = (await auth(request(app).get('/deposito/'), tokenNuevo)).body.data;
        const editar = await auth(
            request(app).put(`/deposito/${principal.id}`).send({ nombre: 'Intento', principal: false }),
            tokenNuevo
        );
        expectBadRequest(editar);
        expect([crear.status, editar.status]).toEqual([400, 400]);
    });
});

describe('POST /deposito', () => {
    it('crea un depósito común con nombre y descripción', async () => {
        const res = await crearDeposito('Depósito con descripción', 'Una descripción');

        expectCreated(res);
        expect(res.body.data).toMatchObject({
            nombre: 'Depósito con descripción',
            descripcion: 'Una descripción',
            principal: false,
            titulos: 0,
            ejemplares: 0
        });
        expect(res.body.data.id).toBeTypeOf('number');
    });

    it('sin descripción queda en null', async () => {
        const res = await crearDeposito('Depósito sin descripción');

        expectCreated(res);
        expect(res.body.data.descripcion).toBeNull();
    });

    it('con descripción null queda en null', async () => {
        const res = await crearDeposito('Depósito desc null', null);

        expectCreated(res);
        expect(res.body.data.descripcion).toBeNull();
    });

    it('sin nombre devuelve 400', async () => {
        const res = await auth(request(app).post('/deposito/').send({ descripcion: 'sin nombre' }));
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });

    it('con nombre vacío devuelve 400', async () => {
        const res = await crearDeposito('   ');
        expectBadRequest(res);
        expect(res.status).toBe(400);
    });
});

describe('GET /deposito', () => {
    it('incluye siempre el principal y sólo los depósitos del usuario', async () => {
        const creado = await crearDeposito('Depósito visible');

        const propios = await auth(request(app).get('/deposito/'));
        expect(propios.status).toBe(200);
        expect(propios.body.data.some((d: { principal: boolean }) => d.principal)).toBe(true);
        expect(propios.body.data.map((d: { id: number }) => d.id)).toContain(creado.body.data.id);

        const ajenos = await auth(request(app).get('/deposito/'), otroToken);
        expect(ajenos.body.data.map((d: { id: number }) => d.id)).not.toContain(creado.body.data.id);
    });

    it('informa titulos y ejemplares y los actualiza con un movimiento', async () => {
        const deposito = (await crearDeposito('Depósito con stock')).body.data;
        await crearLibro(isbn(9701), 'Libro uno');
        await crearLibro(isbn(9702), 'Libro dos');

        const antes = await auth(request(app).get(`/deposito/${deposito.id}`));
        expect(antes.body.data).toMatchObject({ titulos: 0, ejemplares: 0 });

        const mov = await ingreso(deposito.id, [
            { isbn: isbn(9701), cantidad: 3 },
            { isbn: isbn(9702), cantidad: 2 }
        ]);
        expect(mov.status).toBe(201);

        const despues = await auth(request(app).get(`/deposito/${deposito.id}`));
        expect(despues.body.data).toMatchObject({ titulos: 2, ejemplares: 5 });

        const listado = await auth(request(app).get('/deposito/'));
        const enListado = listado.body.data.find((d: { id: number }) => d.id === deposito.id);
        expect(enListado).toMatchObject({ titulos: 2, ejemplares: 5 });
    });

    it('un depósito sin stock informa 0 y 0', async () => {
        const deposito = (await crearDeposito('Depósito vacío')).body.data;
        const res = await auth(request(app).get(`/deposito/${deposito.id}`));

        expect(res.body.data).toMatchObject({ titulos: 0, ejemplares: 0 });
    });
});

describe('PUT /deposito/:id', () => {
    it('actualiza nombre y descripción', async () => {
        const deposito = (await crearDeposito('Original', 'Vieja')).body.data;

        const res = await auth(
            request(app).put(`/deposito/${deposito.id}`).send({ nombre: 'Actualizado', descripcion: 'Nueva' })
        );

        expectUpdated(res);
        expect(res.body.data).toMatchObject({ nombre: 'Actualizado', descripcion: 'Nueva' });
    });

    it('sin nombre devuelve 400 y no modifica', async () => {
        const deposito = (await crearDeposito('No se toca')).body.data;

        const res = await auth(request(app).put(`/deposito/${deposito.id}`).send({ descripcion: 'sin nombre' }));
        expectBadRequest(res);
        expect(res.status).toBe(400);

        const actual = await auth(request(app).get(`/deposito/${deposito.id}`));
        expect(actual.body.data.nombre).toBe('No se toca');
    });

    it('id inexistente o de otro usuario devuelve 404', async () => {
        const deposito = (await crearDeposito('Privado')).body.data;

        const inexistente = await auth(request(app).put('/deposito/999999').send({ nombre: 'Nada' }));
        const ajeno = await auth(request(app).put(`/deposito/${deposito.id}`).send({ nombre: 'Intruso' }), otroToken);

        expectNotFound(inexistente);
        expectNotFound(ajeno);
        expect([inexistente.status, ajeno.status]).toEqual([404, 404]);
    });
});

describe('DELETE /deposito/:id', () => {
    it('un depósito común sin stock se elimina con 204 y deja de aparecer', async () => {
        const deposito = (await crearDeposito('Se borra')).body.data;

        const res = await auth(request(app).delete(`/deposito/${deposito.id}`));
        expect(res.status).toBe(204);

        expectNotFound(await auth(request(app).get(`/deposito/${deposito.id}`)));
        const listado = await auth(request(app).get('/deposito/'));
        expect(listado.body.data.map((d: { id: number }) => d.id)).not.toContain(deposito.id);
    });

    it('con stock devuelve 409 con ejemplares y titulos, y el depósito sigue intacto', async () => {
        const deposito = (await crearDeposito('Bloqueado por stock')).body.data;
        await crearLibro(isbn(9711), 'Libro bloqueante');
        await ingreso(deposito.id, [{ isbn: isbn(9711), cantidad: 4 }]);

        const res = await auth(request(app).delete(`/deposito/${deposito.id}`));

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.errors[0].code).toBe('DepositoConStock');
        expect(res.body.errors[0]).toMatchObject({ ejemplares: 4, titulos: 1 });

        const actual = await auth(request(app).get(`/deposito/${deposito.id}`));
        expect(actual.body.data.ejemplares).toBe(4);
    });

    it('el principal devuelve 403 con un error propio, distinto del 409', async () => {
        const principal = (await auth(request(app).get('/deposito/'))).body.data.find((d: { principal: boolean }) => d.principal);

        const res = await auth(request(app).delete(`/deposito/${principal.id}`));

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.errors[0].code).toBe('DepositoPrincipal');

        const actual = await auth(request(app).get(`/deposito/${principal.id}`));
        expect(actual.status).toBe(200);
    });

    it('tras eliminar un depósito común, sus movimientos históricos siguen mostrando el nombre', async () => {
        const principal = (await auth(request(app).get('/deposito/'))).body.data.find((d: { principal: boolean }) => d.principal);
        const borrable = (await crearDeposito('Depósito borrable')).body.data;
        await crearLibro(isbn(9721), 'Libro histórico');
        await ingreso(principal.id, [{ isbn: isbn(9721), cantidad: 2 }]);

        // Ida y vuelta para poder borrar el depósito (hay que dejarlo vacío).
        const ida = await auth(
            request(app).post('/movimiento/').send({
                origen: { tipo: 'deposito', id: principal.id },
                destino: { tipo: 'deposito', id: borrable.id },
                libros: [{ isbn: isbn(9721), cantidad: 2 }]
            })
        );
        await auth(
            request(app).post('/movimiento/').send({
                origen: { tipo: 'deposito', id: borrable.id },
                destino: { tipo: 'deposito', id: principal.id },
                libros: [{ isbn: isbn(9721), cantidad: 2 }]
            })
        );

        expect((await auth(request(app).delete(`/deposito/${borrable.id}`))).status).toBe(204);

        const detalle = await auth(request(app).get(`/movimiento/${ida.body.data.id}`));
        expect(detalle.body.data.destino).toMatchObject({ tipo: 'deposito', id: borrable.id, nombre: 'Depósito borrable' });

        const listado = await auth(request(app).get('/movimiento/?porPagina=100'));
        const enHistorial = listado.body.data.movimientos.find((m: { id: number }) => m.id === ida.body.data.id);
        expect(enHistorial.destino.nombre).toBe('Depósito borrable');
    });

    it('id inexistente o de otro usuario devuelve 404', async () => {
        const deposito = (await crearDeposito('No borrable por otro')).body.data;

        const inexistente = await auth(request(app).delete('/deposito/999999'));
        const ajeno = await auth(request(app).delete(`/deposito/${deposito.id}`), otroToken);

        expectNotFound(inexistente);
        expectNotFound(ajeno);
        expect([inexistente.status, ajeno.status]).toEqual([404, 404]);
    });
});

// El backfill de datos de la 0005 (depósitos de clientes + traslado de stock +
// historial comercial) tiene que poder correrse más de una vez sin duplicar.
// En la base de test las tablas viejas y la columna `libro_cliente.stock` ya
// no existen, así que se verifica que el bloque sea un no-op al repetirse.
describe('migración 0005: el backfill de datos es idempotente', () => {
    let backfill: string;

    beforeAll(async () => {
        const archivo = fs
            .readdirSync(join(__dirname, '../db/migrations'))
            .find((f) => f.startsWith('0005_') && f.endsWith('.sql'));
        const migracion = fs.readFileSync(join(__dirname, '../db/migrations', archivo as string), 'utf8');
        const desde = migracion.indexOf('DO $$');
        const hasta = migracion.indexOf('--> statement-breakpoint', desde);
        backfill = migracion.slice(desde, hasta).trim();

        await db.$client.query(backfill);
        await db.$client.query(backfill);
    });

    it('cada cliente existente sigue teniendo exactamente un depósito propio', async () => {
        const clientes = await db.select().from(clientesTable);
        const depositos = await db.select().from(depositosTable);

        for (const cliente of clientes) {
            const propios = depositos.filter((d) => d.id_cliente === cliente.id);
            expect(propios).toHaveLength(1);
        }
    });

    it('no aparecen movimientos ni cantidades duplicadas por repetir el backfill', async () => {
        const movimientos = await db.select().from(movimientosTable);
        const claves = movimientos.map((m) => `${m.user}-${m.id}`);
        expect(new Set(claves).size).toBe(claves.length);

        const cantidades = await db.select().from(depositoLibrosTable);
        const pares = cantidades.map((c) => `${c.deposito_id}-${c.id_libro}`);
        expect(new Set(pares).size).toBe(pares.length);
    });
});

describe('GET /libro con deposito_id (specs/018)', () => {
    const isbnLibro = '9780000000181';
    const isbnSinStock = '9780000000182';
    let depositoConStock: number;
    let depositoVacio: number;
    let depositoAjeno: number;

    beforeAll(async () => {
        await crearLibro(isbnLibro, 'Libro 018 con stock');
        await crearLibro(isbnSinStock, 'Libro 018 sin stock');

        const [conStock, vacio, ajeno, propios] = await Promise.all([
            crearDeposito('Depósito 018 con stock'),
            crearDeposito('Depósito 018 vacío'),
            crearDeposito('Depósito 018 ajeno', undefined, otroToken),
            auth(request(app).get('/deposito/'))
        ]);
        depositoConStock = conStock.body.data.id;
        depositoVacio = vacio.body.data.id;
        depositoAjeno = ajeno.body.data.id;

        const principal = propios.body.data.find((d: { principal: boolean }) => d.principal);
        await ingreso(depositoConStock, [{ isbn: isbnLibro, cantidad: 7 }]);
        await ingreso(principal.id, [{ isbn: isbnLibro, cantidad: 2 }]);
    });

    it('devuelve la cantidad del libro en el depósito pedido', async () => {
        const res = await auth(request(app).get(`/libro/?deposito_id=${depositoConStock}&pageSize=1000`));
        expect(res.status).toBe(200);

        const libro = res.body.items.find((l: { isbn: string }) => l.isbn === isbnLibro);
        expect(libro.disponible_en_deposito).toBe(7);
        expect(libro.disponible_principal).toBe(2);
    });

    it('un libro sin stock en el depósito devuelve 0, no null', async () => {
        const res = await auth(request(app).get(`/libro/?deposito_id=${depositoVacio}&pageSize=1000`));
        expect(res.status).toBe(200);

        const sinStock = res.body.items.find((l: { isbn: string }) => l.isbn === isbnSinStock);
        expect(sinStock.disponible_en_deposito).toBe(0);

        const conStockEnOtro = res.body.items.find((l: { isbn: string }) => l.isbn === isbnLibro);
        expect(conStockEnOtro.disponible_en_deposito).toBe(0);
    });

    it('sin deposito_id no incluye el campo', async () => {
        const res = await auth(request(app).get('/libro/?pageSize=1000'));
        expect(res.status).toBe(200);

        const libro = res.body.items.find((l: { isbn: string }) => l.isbn === isbnLibro);
        expect(libro).not.toHaveProperty('disponible_en_deposito');
    });

    it('depósito inexistente devuelve 404', async () => {
        const res = await auth(request(app).get('/libro/?deposito_id=999999'));
        expectNotFound(res);
    });

    it('depósito de otro usuario devuelve 404', async () => {
        const res = await auth(request(app).get(`/libro/?deposito_id=${depositoAjeno}`));
        expectNotFound(res);
    });
});
