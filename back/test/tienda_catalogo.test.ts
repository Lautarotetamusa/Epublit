import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { eq } from 'drizzle-orm';
import { usersTable } from '../src/modules/user/user.schema';
import { shippingConfigTable } from '../src/modules/tienda/shipping/shippingConfig.schema';
import { mercadoPagoTable } from '../src/modules/tienda/payment/mercadopago.schema';
import { cargarStockPrincipal, expectCreated, getRolId } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { dni, isbn } from '../seeders/data';

const ORIGEN = 'https://tienda-catalogo.test';
const ISBN = isbn(9500);
const ISBN_SIN_PERSONAS = isbn(9501);
const ISBN_AJENO = isbn(9502);
const ISBN_PERSONAS_BAJA = isbn(9503);

let token: string;
let otroToken: string;
let apiKey: string;
let rolTraductor: { id: number; nombre: string };
let dniSeq = 9500;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

const publica = (path: string, key = apiKey, origin = ORIGEN) =>
    request(app)
        .get(`/public/tienda/v1${path}`)
        .set('X-API-Key', key)
        .set('Origin', origin);

const crearIntegracion = async (nombre: string, origen: string, t = token) => {
    const res = await auth(request(app).post('/integraciones').send({ nombre, origen }), t);
    expectCreated(res);
    return res.body.data.apiKey as string;
};

const crearLibro = async (isbnLibro: string, titulo: string, extra: Record<string, unknown> = {}, t = token) => {
    const res = await auth(
        request(app).post('/libro/').send({
            isbn: isbnLibro,
            titulo,
            fecha_edicion: '2020-02-17',
            precio: 12500,
            ...extra
        }),
        t
    );
    expectCreated(res);
    return res.body.data;
};

const crearPersona = async (nombre: string, extra: Record<string, unknown> = {}) => {
    const res = await auth(
        request(app)
            .post('/persona/')
            .send({ nombre, dni: dni(dniSeq++), ...extra })
    );
    expectCreated(res);
    return res.body.data;
};

const crearRol = async (nombre: string) => {
    const res = await auth(request(app).post('/rol/').send({ nombre }));
    expectCreated(res);
    return res.body.data;
};

beforeAll(async () => {
    const res = await request(app)
        .post('/user/login')
        .send({ username: 'libreria_sur', password: PASSWORD_SEED });
    token = res.body.token;

    const otro = await request(app)
        .post('/user/login')
        .send({ username: 'editorial_norte', password: PASSWORD_SEED });
    otroToken = otro.body.token;

    apiKey = await crearIntegracion('Catálogo', ORIGEN);

    await crearLibro(ISBN, 'Senderos de prueba', { peso_kg: 0.45 });
    await cargarStockPrincipal(app, token, ISBN, 5);

    await crearLibro(ISBN_SIN_PERSONAS, 'Libro sin personas');
    await crearLibro(ISBN_AJENO, 'Libro de otra cuenta', {}, otroToken);

    const rolAutor = await getRolId(app, token, 'autor');
    const rolIlustrador = await getRolId(app, token, 'ilustrador');
    rolTraductor = await crearRol('traductor');

    const ana = await crearPersona('Ana Pérez', { bio: 'Bio pública de Ana' });
    const luis = await crearPersona('Luis Gómez');

    const vinculos = await auth(
        request(app)
            .post(`/libro/${ISBN}/personas`)
            .send([
                { id_persona: ana.id, rol: rolAutor, porcentaje: 50 },
                { id_persona: ana.id, rol: rolTraductor.id, porcentaje: 10 },
                { id_persona: luis.id, rol: rolIlustrador, porcentaje: 20 }
            ])
    );
    expectCreated(vinculos);

    // Libro para probar la exclusión de personas/roles dados de baja.
    await crearLibro(ISBN_PERSONAS_BAJA, 'Personas dadas de baja');
    const rolTemporal = await crearRol('temporal');
    const temporal = await crearPersona('Persona temporal');
    const vinculoTemporal = await auth(
        request(app)
            .post(`/libro/${ISBN_PERSONAS_BAJA}/personas`)
            .send({ id_persona: temporal.id, rol: rolTemporal.id, porcentaje: 10 })
    );
    expectCreated(vinculoTemporal);

    const bajaPersona = await auth(request(app).delete(`/persona/${temporal.id}`));
    expect(bajaPersona.status).toBe(200);
    const bajaRol = await auth(request(app).delete(`/rol/${rolTemporal.id}`));
    expect(bajaRol.status).toBe(200);
});

afterAll(async () => {
    // No dejar roles/libros propios que alteren el estado inicial que asumen
    // otros archivos de test (ej. rol.test.ts).
    await auth(request(app).delete(`/libro/${ISBN}`));
    await auth(request(app).delete(`/rol/${rolTraductor.id}`));

    const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, 'libreria_sur'));
    await db.delete(shippingConfigTable).where(eq(shippingConfigTable.user, user.id));
    await db.delete(mercadoPagoTable).where(eq(mercadoPagoTable.user, user.id));

    db.$client.end();
    server.close();
});

describe('GET /public/tienda/v1/libros', () => {
    it('lista sólo libros de la cuenta con búsqueda y paginación', async () => {
        const res = await publica(`/libros?buscar=${ISBN}&pagina=1&porPagina=20`);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ total: 1, pagina: 1, porPagina: 20 });
        expect(res.body.libros).toHaveLength(1);
        expect(res.body.libros[0]).toMatchObject({
            isbn: ISBN,
            titulo: 'Senderos de prueba',
            precio: 12500,
            disponibleParaVenta: 5,
            enStock: true
        });
    });

    it('incluye el resumen de personas y no expone datos internos', async () => {
        const res = await publica(`/libros?buscar=${ISBN}`);
        const libro = res.body.libros[0];

        expect(libro.personas).toEqual([
            { nombre: 'Ana Pérez', rol: 'autor' },
            { nombre: 'Luis Gómez', rol: 'ilustrador' },
            { nombre: 'Ana Pérez', rol: 'traductor' }
        ]);

        for (const persona of libro.personas) {
            expect(persona.bio).toBeUndefined();
            expect(persona.dni).toBeUndefined();
            expect(persona.email).toBeUndefined();
            expect(persona.porcentaje).toBeUndefined();
        }

        expect(libro.stock).toBeUndefined();
        expect(libro.disponible_principal).toBeUndefined();
        expect(libro.monto_acordado).toBeUndefined();
    });

    it('un libro sin stock aparece con enStock=false y disponibilidad 0', async () => {
        const res = await publica(`/libros?buscar=${ISBN_SIN_PERSONAS}`);

        expect(res.status).toBe(200);
        expect(res.body.libros[0]).toMatchObject({
            isbn: ISBN_SIN_PERSONAS,
            disponibleParaVenta: 0,
            enStock: false,
            personas: []
        });
    });

    it('no lista libros de otra cuenta', async () => {
        const res = await publica(`/libros?buscar=${ISBN_AJENO}`);

        expect(res.status).toBe(200);
        expect(res.body.libros).toHaveLength(0);
        expect(res.body.total).toBe(0);
    });

    it('una paginación inválida devuelve el error público estable', async () => {
        const res = await publica('/libros?pagina=0');

        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe('validacion');
        expect(res.body.error.detalles).toBeInstanceOf(Array);
    });
});

describe('GET /public/tienda/v1/libros/:isbn', () => {
    it('devuelve las personas completas, con bio y orden estable', async () => {
        const res = await publica(`/libros/${ISBN}`);

        expect(res.status).toBe(200);
        expect(res.body.personas).toEqual([
            { nombre: 'Ana Pérez', rol: 'autor', bio: 'Bio pública de Ana' },
            { nombre: 'Luis Gómez', rol: 'ilustrador' },
            { nombre: 'Ana Pérez', rol: 'traductor', bio: 'Bio pública de Ana' }
        ]);

        expect(res.body.stock).toBeUndefined();
        expect(res.body.stock_negativo_permitido).toBeUndefined();
        expect(res.body.porcentaje).toBeUndefined();
    });

    it('un libro sin personas devuelve []', async () => {
        const res = await publica(`/libros/${ISBN_SIN_PERSONAS}`);

        expect(res.status).toBe(200);
        expect(res.body.personas).toEqual([]);
    });

    it('excluye personas y roles dados de baja', async () => {
        const res = await publica(`/libros/${ISBN_PERSONAS_BAJA}`);

        expect(res.status).toBe(200);
        expect(res.body.personas).toEqual([]);
    });

    it('un ISBN de otra cuenta devuelve 404', async () => {
        const res = await publica(`/libros/${ISBN_AJENO}`);

        expect(res.status).toBe(404);
        expect(res.body.error.codigo).toBe('no_encontrado');
    });
});

describe('GET /public/tienda/v1/config', () => {
    it('devuelve la configuración pública sin credenciales', async () => {
        const res = await publica('/config');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            moneda: 'ARS',
            mercadopago: { disponible: false },
            envio: { disponible: false },
            retiro: { disponible: false }
        });
        expect(JSON.stringify(res.body)).not.toMatch(/token|credential|password|secret/i);
    });

    it('refleja pago, envío y retiro configurados sin exponer credenciales', async () => {
        const [user] = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.username, 'libreria_sur'));

        await db.insert(shippingConfigTable).values({
            user: user.id,
            micorreo_usuario: 'usuario-micorreo',
            micorreo_credencial_cifrada: 'credencial-cifrada',
            micorreo_customer_id: 'customer-catalogo',
            paqar_agreement: 'agreement-catalogo',
            paqar_api_key_cifrada: 'api-key-catalogo',
            paqar_seller_id: 'seller-catalogo',
            origen_codigo_postal: '1425',
            peso_promedio_kg: 0.5,
            retiro_activo: true,
            retiro_direccion: 'Av. Retiro 123',
            retiro_horario: 'Lunes a viernes de 9 a 18'
        });
        await db.insert(mercadoPagoTable).values({
            user: user.id,
            mp_user_id: 'mp-catalogo-test',
            access_token_cifrado: 'token-cifrado'
        });

        const res = await publica('/config');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            moneda: 'ARS',
            mercadopago: { disponible: true },
            envio: { disponible: true },
            retiro: {
                disponible: true,
                direccion: 'Av. Retiro 123',
                horario: 'Lunes a viernes de 9 a 18'
            }
        });
        expect(JSON.stringify(res.body)).not.toContain('credencial-cifrada');
        expect(JSON.stringify(res.body)).not.toContain('token-cifrado');
    });
});
