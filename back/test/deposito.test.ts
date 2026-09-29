import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { createMockComprobanteService } from '../src/lib/comprobantes/comprobante.mock';
import { isbn } from '../seeders/data';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectBadRequest, expectCreated, expectNotFound, expectUpdated } from './util';
import { usersTable } from '../src/modules/user/user.schema';
import { librosTable } from '../src/modules/libro/libro.schema';
import { depositosTable } from '../src/modules/deposito/deposito.schema';
import { depositoLibrosTable } from '../src/modules/deposito/depositoLibros.schema';
import { movimientosTable, movimientosLibrosTable } from '../src/modules/movimiento/movimiento.schema';

const container = createContainer({
    afipService: createMockAfipService(),
    comprobanteService: createMockComprobanteService()
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

// Criterios de la tarea 2: la migración de datos es idempotente y no pierde ni
// duplica stock. Se corre el mismo bloque que aplicó la migración 0004.
describe('migración de depósito principal y stock existente', () => {
    const username = 'migracion_user';
    const stockInicial = 7;
    let userId: number;
    let libroId: number;
    let backfill: string;

    beforeAll(async () => {
        const archivo = fs
            .readdirSync(join(__dirname, '../db/migrations'))
            .find((f) => f.startsWith('0004_') && f.endsWith('.sql'));
        const migracion = fs.readFileSync(join(__dirname, '../db/migrations', archivo as string), 'utf8');
        backfill = migracion.slice(migracion.indexOf('DO $$'));

        const [user] = await db
            .insert(usersTable)
            .values({
                username,
                password: 'x',
                cuit: '20400000021',
                cond_fiscal: 'CONSUMIDOR FINAL',
                razon_social: 'Usuario migrado SA',
                domicilio: 'Calle Falsa 123',
                fecha_inicio: '01/01/2020'
            })
            .returning();
        userId = user.id;

        const [libro] = await db
            .insert(librosTable)
            .values({
                isbn: isbn(9731),
                titulo: 'Libro preexistente',
                fecha_edicion: '2020-01-01',
                precio: 100,
                stock: stockInicial,
                user: userId
            })
            .returning();
        libroId = libro.id_libro;

        await db.$client.query(backfill);
        await db.$client.query(backfill);
    });

    afterAll(async () => {
        await db.delete(movimientosLibrosTable).where(eq(movimientosLibrosTable.user, userId));
        await db.delete(movimientosTable).where(eq(movimientosTable.user, userId));
        await db.delete(depositoLibrosTable).where(eq(depositoLibrosTable.user, userId));
        await db.delete(depositosTable).where(eq(depositosTable.user, userId));
        await db.delete(librosTable).where(eq(librosTable.user, userId));
        await db.delete(usersTable).where(eq(usersTable.id, userId));
    });

    it('crea un único principal, vuelca el stock y registra el ingreso, aunque se corra dos veces', async () => {
        const depositos = await db
            .select()
            .from(depositosTable)
            .where(and(eq(depositosTable.user, userId), eq(depositosTable.principal, true)));
        expect(depositos).toHaveLength(1);

        const cantidades = await db
            .select()
            .from(depositoLibrosTable)
            .where(and(eq(depositoLibrosTable.user, userId), eq(depositoLibrosTable.id_libro, libroId)));
        expect(cantidades).toHaveLength(1);
        expect(cantidades[0].cantidad).toBe(stockInicial);
        expect(cantidades[0].deposito_id).toBe(depositos[0].id);

        const movimientos = await db.select().from(movimientosTable).where(eq(movimientosTable.user, userId));
        expect(movimientos).toHaveLength(1);
        expect(movimientos[0]).toMatchObject({ origen_tipo: 'exterior', destino_tipo: 'deposito' });

        const lineas = await db
            .select()
            .from(movimientosLibrosTable)
            .where(eq(movimientosLibrosTable.movimiento_id, movimientos[0].id));
        expect(lineas).toHaveLength(1);
        expect(lineas[0]).toMatchObject({ id_libro: libroId, cantidad: stockInicial });
    });
});
