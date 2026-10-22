import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";
import { eq } from "drizzle-orm";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import {
    expectBadRequest,
    expectCreated,
    expectUpdated,
    expectNotFound,
    expectList
} from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';
import { seedColecciones } from '../seeders/colecciones.seeder';
import { createColeccionModule } from '../src/modules/coleccion';
import { createLocalStorage } from '../src/lib/storage';
import { env } from '../src/env';
import { usersTable } from '../src/modules/user/user.schema';

// PNG 1x1 válido (mismo criterio que libro_portada.test.ts: la validación de
// tipo se basa en el Content-Type declarado, y sirve para tener bytes reales
// que devolver por `GET /files/...`).
const PNG_1X1 = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082",
    "hex"
);

// Libro seedeado, creado antes de este cambio (ver seeders/libros.seeder.ts).
const ISBN_SEED = isbn(0);

let token: string;
let otroToken: string;

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
    server.close();
});

function pathnameOf(url: string): string {
    return new URL(url).pathname;
}

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

function crearColeccion(titulo: string, descripcion?: string, t = token) {
    const body = descripcion === undefined ? { titulo } : { titulo, descripcion };

    return auth(request(app).post('/coleccion/').send(body), t);
}

function crearLibro(isbnLibro: string, titulo: string, extra: Record<string, unknown> = {}, t = token) {
    return auth(
        request(app).post('/libro/').send({
            isbn: isbnLibro,
            titulo,
            fecha_edicion: '2020-02-17',
            precio: 10000,
            ...extra
        }),
        t
    );
}

describe('POST /coleccion', () => {
    it('crea una colección con título y descripción', async () => {
        const res = await crearColeccion('Colección con descripción', 'Una descripción');

        expectCreated(res);
        expect(res.body.data.titulo).toEqual('Colección con descripción');
        expect(res.body.data.descripcion).toEqual('Una descripción');
        expect(res.body.data.portada_url).toBeNull();
        expect(res.body.data.cantidad_libros).toEqual(0);
        expect(res.body.data.id).toBeTypeOf('number');
    });

    it('sin descripción queda en null', async () => {
        const res = await crearColeccion('Colección sin descripción');

        expectCreated(res);
        expect(res.body.data.descripcion).toBeNull();
    });

    it('con descripción null queda en null', async () => {
        const res = await auth(
            request(app).post('/coleccion/').send({ titulo: 'Colección desc null', descripcion: null })
        );

        expectCreated(res);
        expect(res.body.data.descripcion).toBeNull();
    });

    it('sin título devuelve 400 y no crea nada', async () => {
        const antes = await auth(request(app).get('/coleccion/'));

        const res = await auth(request(app).post('/coleccion/').send({ descripcion: 'sin titulo' }));

        expectBadRequest(res);

        const despues = await auth(request(app).get('/coleccion/'));
        expect(despues.body.data).toHaveLength(antes.body.data.length);
    });

    it('con título vacío devuelve 400 y no crea nada', async () => {
        const antes = await auth(request(app).get('/coleccion/'));

        const res = await crearColeccion('   ');

        expectBadRequest(res);

        const despues = await auth(request(app).get('/coleccion/'));
        expect(despues.body.data).toHaveLength(antes.body.data.length);
    });

    it('la colección creada aparece en el listado del dueño y no en el de otro usuario', async () => {
        const creada = await crearColeccion('Colección visible');
        const id = creada.body.data.id;

        const propias = await auth(request(app).get('/coleccion/'));
        expect(propias.body.data.map((c: { id: number }) => c.id)).toContain(id);

        const ajenas = await auth(request(app).get('/coleccion/'), otroToken);
        expect(ajenas.body.data.map((c: { id: number }) => c.id)).not.toContain(id);
    });
});

describe('GET /coleccion', () => {
    it('devuelve las colecciones del usuario con todos los campos', async () => {
        const res = await auth(request(app).get('/coleccion/'));

        expect(res.status).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.length).toBeGreaterThan(0);

        for (const coleccion of res.body.data) {
            expect(coleccion).toHaveProperty('id');
            expect(coleccion).toHaveProperty('titulo');
            expect(coleccion).toHaveProperty('descripcion');
            expect(coleccion).toHaveProperty('portada_url');
            expect(coleccion).toHaveProperty('cantidad_libros');
        }
    });

    it('una colección recién creada informa cantidad_libros en 0', async () => {
        const creada = await crearColeccion('Colección vacía');

        const res = await auth(request(app).get(`/coleccion/${creada.body.data.id}`));

        expect(res.body.data.cantidad_libros).toEqual(0);
    });

    it('asignar un libro se refleja en su cantidad_libros', async () => {
        const creada = await crearColeccion('Colección para contar');
        const id = creada.body.data.id;

        await crearLibro(isbn(9401), 'Libro para contar', { coleccion_id: id });

        const res = await auth(request(app).get(`/coleccion/${id}`));
        expect(res.body.data.cantidad_libros).toEqual(1);
    });

    it('un libro borrado del catálogo deja de contarse', async () => {
        const creada = await crearColeccion('Colección con libro borrado');
        const id = creada.body.data.id;
        const isbnBorrado = isbn(9402);

        await crearLibro(isbnBorrado, 'Libro que se borra', { coleccion_id: id });
        await auth(request(app).delete(`/libro/${isbnBorrado}`));

        const res = await auth(request(app).get(`/coleccion/${id}`));
        expect(res.body.data.cantidad_libros).toEqual(0);
    });
});

describe('GET /coleccion/:id', () => {
    it('devuelve la colección con los mismos campos que el listado', async () => {
        const creada = await crearColeccion('Colección puntual', 'Detalle');

        const res = await auth(request(app).get(`/coleccion/${creada.body.data.id}`));

        expect(res.status).toEqual(200);
        expect(res.body.data).toMatchObject({
            id: creada.body.data.id,
            titulo: 'Colección puntual',
            descripcion: 'Detalle',
            portada_url: null,
            cantidad_libros: 0
        });
    });

    it('id inexistente devuelve 404', async () => {
        const res = await auth(request(app).get('/coleccion/999999'));
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('de otro usuario devuelve 404', async () => {
        const creada = await crearColeccion('Colección privada');

        const res = await auth(request(app).get(`/coleccion/${creada.body.data.id}`), otroToken);
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });
});

describe('PUT /coleccion/:id', () => {
    it('actualiza título y descripción', async () => {
        const creada = await crearColeccion('Original', 'Descripción original');
        const id = creada.body.data.id;

        const res = await auth(
            request(app).put(`/coleccion/${id}`).send({ titulo: 'Actualizada', descripcion: 'Descripción nueva' })
        );

        expectUpdated(res);
        expect(res.body.data.titulo).toEqual('Actualizada');
        expect(res.body.data.descripcion).toEqual('Descripción nueva');
    });

    it('puede dejar la descripción en null', async () => {
        const creada = await crearColeccion('Con descripción a borrar', 'Algo');

        const res = await auth(
            request(app).put(`/coleccion/${creada.body.data.id}`).send({ titulo: 'Sin descripción', descripcion: null })
        );

        expectUpdated(res);
        expect(res.body.data.descripcion).toBeNull();
    });

    it('sin título devuelve 400 y no modifica', async () => {
        const creada = await crearColeccion('No se debe tocar');
        const id = creada.body.data.id;

        const res = await auth(request(app).put(`/coleccion/${id}`).send({ descripcion: 'solo descripcion' }));
        expectBadRequest(res);

        const actual = await auth(request(app).get(`/coleccion/${id}`));
        expect(actual.body.data.titulo).toEqual('No se debe tocar');
    });

    it('con título vacío devuelve 400 y no modifica', async () => {
        const creada = await crearColeccion('No se debe tocar 2');
        const id = creada.body.data.id;

        const res = await auth(request(app).put(`/coleccion/${id}`).send({ titulo: '' }));
        expectBadRequest(res);

        const actual = await auth(request(app).get(`/coleccion/${id}`));
        expect(actual.body.data.titulo).toEqual('No se debe tocar 2');
    });

    it('id inexistente devuelve 404', async () => {
        const res = await auth(request(app).put('/coleccion/999999').send({ titulo: 'Nada' }));
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('de otro usuario devuelve 404', async () => {
        const creada = await crearColeccion('Ajena no editable');

        const res = await auth(
            request(app).put(`/coleccion/${creada.body.data.id}`).send({ titulo: 'Intruso' }),
            otroToken
        );
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('actualizar no cambia los libros ni la cantidad', async () => {
        const creada = await crearColeccion('Colección con libros', 'antes');
        const id = creada.body.data.id;
        await crearLibro(isbn(9410), 'Libro estable', { coleccion_id: id });

        const res = await auth(request(app).put(`/coleccion/${id}`).send({ titulo: 'Renombrada' }));

        expect(res.body.data.cantidad_libros).toEqual(1);

        const libros = await auth(request(app).get(`/coleccion/${id}/libros`));
        expect(libros.body.items).toHaveLength(1);
        expect(libros.body.items[0].isbn).toEqual(isbn(9410));
    });
});

describe('DELETE /coleccion/:id', () => {
    it('una colección sin libros se borra con 204 y deja de existir', async () => {
        const creada = await crearColeccion('Se borra');

        const res = await auth(request(app).delete(`/coleccion/${creada.body.data.id}`));

        expect(res.status).toEqual(204);
        expect(res.body).toEqual({});

        const get = await auth(request(app).get(`/coleccion/${creada.body.data.id}`));
        expectNotFound(get);
    });

    it('con libros devuelve 409 y la colección sigue con sus libros intactos', async () => {
        const creada = await crearColeccion('Bloqueada');
        const id = creada.body.data.id;
        await crearLibro(isbn(9420), 'Libro que bloquea', { coleccion_id: id });

        const res = await auth(request(app).delete(`/coleccion/${id}`));

        expect(res.status).toEqual(409);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors[0].message).toBeTruthy();

        const get = await auth(request(app).get(`/coleccion/${id}`));
        expect(get.status).toEqual(200);
        expect(get.body.data.cantidad_libros).toEqual(1);
    });

    it('id inexistente devuelve 404', async () => {
        const res = await auth(request(app).delete('/coleccion/999999'));
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('de otro usuario devuelve 404', async () => {
        const creada = await crearColeccion('No la borra otro');

        const res = await auth(request(app).delete(`/coleccion/${creada.body.data.id}`), otroToken);
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('tras borrar una vacía no deja referencias colgantes', async () => {
        const creada = await crearColeccion('Desasignada');
        const id = creada.body.data.id;
        const isbnLibro = isbn(9430);
        await crearLibro(isbnLibro, 'Libro que se queda sin colección', { coleccion_id: id });
        await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: null }));
        await auth(request(app).delete(`/coleccion/${id}`));

        const libro = await auth(request(app).get(`/libro/${isbnLibro}`));
        expect(libro.status).toEqual(200);
        expect(libro.body.data.coleccion_id).toBeNull();
        expect(libro.body.data.coleccion_titulo).toBeNull();
    });
});

describe('portada de colección', () => {
    it('subir una imagen JPG/PNG devuelve 200 con portada_url no nula y la url sirve la imagen', async () => {
        const creada = await crearColeccion('Con portada');

        const res = await auth(
            request(app)
                .post(`/coleccion/${creada.body.data.id}/portada`)
                .attach('portada', PNG_1X1, { filename: 'portada.png', contentType: 'image/png' })
        );

        expect(res.status).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.portada_url).not.toBeNull();

        const imagen = await request(app).get(pathnameOf(res.body.data.portada_url));
        expect(imagen.status).toEqual(200);
        expect(imagen.headers['content-type']).toContain('image/');

        const get = await auth(request(app).get(`/coleccion/${creada.body.data.id}`));
        expect(get.body.data.portada_url).toEqual(res.body.data.portada_url);
    });

    it('una segunda imagen reemplaza la portada y la url vieja deja de servir', async () => {
        const creada = await crearColeccion('Con reemplazo');
        const id = creada.body.data.id;

        const primera = await auth(
            request(app)
                .post(`/coleccion/${id}/portada`)
                .attach('portada', PNG_1X1, { filename: 'uno.png', contentType: 'image/png' })
        );
        const urlVieja = primera.body.data.portada_url;

        const segunda = await auth(
            request(app)
                .post(`/coleccion/${id}/portada`)
                .attach('portada', PNG_1X1, { filename: 'dos.jpg', contentType: 'image/jpeg' })
        );

        expect(segunda.status).toEqual(200);
        expect(segunda.body.data.portada_url).not.toEqual(urlVieja);

        const vieja = await request(app).get(pathnameOf(urlVieja));
        expect(vieja.status).toEqual(404);

        const nueva = await request(app).get(pathnameOf(segunda.body.data.portada_url));
        expect(nueva.status).toEqual(200);
    });

    it('un tipo distinto a JPG/PNG devuelve 415 y no modifica', async () => {
        const creada = await crearColeccion('Tipo inválido');
        const id = creada.body.data.id;

        const res = await auth(
            request(app)
                .post(`/coleccion/${id}/portada`)
                .attach('portada', Buffer.from('%PDF-1.4'), { filename: 'archivo.pdf', contentType: 'application/pdf' })
        );

        expect(res.status).toEqual(415);
        expect(res.body.success).toEqual(false);

        const actual = await auth(request(app).get(`/coleccion/${id}`));
        expect(actual.body.data.portada_url).toBeNull();
    });

    it('un archivo de más de 5 MB devuelve 413 y no modifica', async () => {
        const creada = await crearColeccion('Peso excesivo');
        const id = creada.body.data.id;
        const grande = Buffer.alloc(5 * 1024 * 1024 + 1, 1);

        const res = await auth(
            request(app)
                .post(`/coleccion/${id}/portada`)
                .attach('portada', grande, { filename: 'grande.png', contentType: 'image/png' })
        );

        expect(res.status).toEqual(413);

        const actual = await auth(request(app).get(`/coleccion/${id}`));
        expect(actual.body.data.portada_url).toBeNull();
    });

    it('sin archivo devuelve 400 y no modifica', async () => {
        const creada = await crearColeccion('Sin archivo');

        const res = await auth(request(app).post(`/coleccion/${creada.body.data.id}/portada`));
        expectBadRequest(res);
        expect(res.body.success).toEqual(false);
    });

    it('id inexistente devuelve 404', async () => {
        const res = await auth(
            request(app)
                .post('/coleccion/999999/portada')
                .attach('portada', PNG_1X1, { filename: 'portada.png', contentType: 'image/png' })
        );
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('de otro usuario devuelve 404', async () => {
        const creada = await crearColeccion('Portada ajena');

        const res = await auth(
            request(app)
                .post(`/coleccion/${creada.body.data.id}/portada`)
                .attach('portada', PNG_1X1, { filename: 'portada.png', contentType: 'image/png' }),
            otroToken
        );
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('quitar la portada devuelve 200 con portada_url en null y la url vieja deja de servir', async () => {
        const creada = await crearColeccion('Con portada a quitar');
        const id = creada.body.data.id;

        const subida = await auth(
            request(app)
                .post(`/coleccion/${id}/portada`)
                .attach('portada', PNG_1X1, { filename: 'portada.png', contentType: 'image/png' })
        );
        const urlVieja = subida.body.data.portada_url;

        const res = await auth(request(app).delete(`/coleccion/${id}/portada`));

        expect(res.status).toEqual(200);
        expect(res.body.data.portada_url).toBeNull();

        const vieja = await request(app).get(pathnameOf(urlVieja));
        expect(vieja.status).toEqual(404);
    });

    it('quitar la portada de una colección sin portada devuelve 200 (idempotente)', async () => {
        const creada = await crearColeccion('Sin portada a quitar');

        const res = await auth(request(app).delete(`/coleccion/${creada.body.data.id}/portada`));

        expect(res.status).toEqual(200);
        expect(res.body.data.portada_url).toBeNull();
    });

    it('quitar la portada de otro usuario devuelve 404', async () => {
        const creada = await crearColeccion('Portada no borrable ajena');

        const res = await auth(request(app).delete(`/coleccion/${creada.body.data.id}/portada`), otroToken);
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });
});

describe('colección del libro', () => {
    it('POST /libro con coleccion_id deja al libro en esa colección', async () => {
        const creada = await crearColeccion('Destino de alta');

        const res = await crearLibro(isbn(9440), 'Libro asignado al crear', { coleccion_id: creada.body.data.id });

        expectCreated(res);
        expect(res.body.data.coleccion_id).toEqual(creada.body.data.id);
        expect(res.body.data.coleccion_titulo).toEqual('Destino de alta');
    });

    it('PUT reemplaza la colección anterior (nunca acumula)', async () => {
        const a = await crearColeccion('Colección A');
        const b = await crearColeccion('Colección B');
        const isbnLibro = isbn(9441);
        await crearLibro(isbnLibro, 'Libro que se mueve', { coleccion_id: a.body.data.id });

        const res = await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: b.body.data.id }));

        expectUpdated(res);
        expect(res.body.data.coleccion_id).toEqual(b.body.data.id);
        expect(res.body.data.coleccion_titulo).toEqual('Colección B');
    });

    it('PUT con coleccion_id null deja al libro sin colección', async () => {
        const a = await crearColeccion('Colección que se suelta');
        const isbnLibro = isbn(9442);
        await crearLibro(isbnLibro, 'Libro que se suelta', { coleccion_id: a.body.data.id });

        const res = await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: null }));

        expectUpdated(res);
        expect(res.body.data.coleccion_id).toBeNull();
        expect(res.body.data.coleccion_titulo).toBeNull();
    });

    it('PUT sin coleccion_id no cambia la colección actual', async () => {
        const a = await crearColeccion('Colección que se mantiene');
        const isbnLibro = isbn(9443);
        await crearLibro(isbnLibro, 'Libro que mantiene', { coleccion_id: a.body.data.id });

        const res = await auth(request(app).put(`/libro/${isbnLibro}`).send({ precio: 12000 }));

        expectUpdated(res);
        expect(res.body.data.precio).toEqual(12000);
        expect(res.body.data.coleccion_id).toEqual(a.body.data.id);
    });

    it('PUT con coleccion_id inexistente devuelve 404 y no modifica el libro', async () => {
        const a = await crearColeccion('Colección que no cambia');
        const isbnLibro = isbn(9444);
        await crearLibro(isbnLibro, 'Libro inmutable', { coleccion_id: a.body.data.id });

        const res = await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: 999999 }));
        expectNotFound(res);

        const actual = await auth(request(app).get(`/libro/${isbnLibro}`));
        expect(actual.body.data.coleccion_id).toEqual(a.body.data.id);
    });

    it('PUT con coleccion_id de otro usuario devuelve 404 y no modifica el libro', async () => {
        const ajena = await crearColeccion('Colección de otro', undefined, otroToken);
        const isbnLibro = isbn(9445);
        await crearLibro(isbnLibro, 'Libro no ajeno', {});

        const res = await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: ajena.body.data.id }));
        expectNotFound(res);

        const actual = await auth(request(app).get(`/libro/${isbnLibro}`));
        expect(actual.body.data.coleccion_id).toBeNull();
    });

    it('un libro se mueve A→B→A sin errores ni acumulación', async () => {
        const a = await crearColeccion('Ida y vuelta A');
        const b = await crearColeccion('Ida y vuelta B');
        const isbnLibro = isbn(9446);
        await crearLibro(isbnLibro, 'Libro ida y vuelta', { coleccion_id: a.body.data.id });

        await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: b.body.data.id }));
        const vuelta = await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: a.body.data.id }));

        expect(vuelta.body.data.coleccion_id).toEqual(a.body.data.id);
        expect(vuelta.body.data.coleccion_titulo).toEqual('Ida y vuelta A');

        const librosA = await auth(request(app).get(`/coleccion/${a.body.data.id}/libros`));
        expect(librosA.body.pagination.total).toEqual(1);
    });
});

describe('lectura de libro con colección', () => {
    it('GET /libro/:isbn incluye coleccion_id y coleccion_titulo reales', async () => {
        const creada = await crearColeccion('Colección de lectura');
        const isbnLibro = isbn(9450);
        await crearLibro(isbnLibro, 'Libro de lectura', { coleccion_id: creada.body.data.id });

        const res = await auth(request(app).get(`/libro/${isbnLibro}`));

        expect(res.status).toEqual(200);
        expect(res.body.data.coleccion_id).toEqual(creada.body.data.id);
        expect(res.body.data.coleccion_titulo).toEqual('Colección de lectura');
    });

    it('GET /libro/:isbn de un libro sin colección devuelve ambos en null', async () => {
        const res = await auth(request(app).get(`/libro/${ISBN_SEED}`));

        expect(res.status).toEqual(200);
        expect(res.body.data.coleccion_id).toBeNull();
        expect(res.body.data.coleccion_titulo).toBeNull();
    });

    it('GET /libro y GET /libro/lista_libros incluyen los campos de colección', async () => {
        const listado = await auth(request(app).get('/libro?pageSize=100'));

        expectList(listado);
        for (const libro of listado.body.items) {
            expect(libro).toHaveProperty('coleccion_id');
            expect(libro).toHaveProperty('coleccion_titulo');
        }

        const csv = await auth(request(app).get('/libro/lista_libros'));
        expect(csv.status).toEqual(200);
        expect(csv.text).toContain('coleccion_id');
        expect(csv.text).toContain('coleccion_titulo');
    });

    it('tras cambiar o quitar la colección, la lectura inmediata lo refleja', async () => {
        const creada = await crearColeccion('Lectura inmediata');
        const isbnLibro = isbn(9451);
        await crearLibro(isbnLibro, 'Libro de cambio inmediato', {});

        await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: creada.body.data.id }));
        const asignado = await auth(request(app).get(`/libro/${isbnLibro}`));
        expect(asignado.body.data.coleccion_titulo).toEqual('Lectura inmediata');

        await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: null }));
        const liberado = await auth(request(app).get(`/libro/${isbnLibro}`));
        expect(liberado.body.data.coleccion_id).toBeNull();
    });
});

describe('GET /coleccion/:id/libros', () => {
    it('devuelve sólo los libros de esa colección con isbn, título, precio y portada', async () => {
        const creada = await crearColeccion('Listado propio');
        const id = creada.body.data.id;
        await crearLibro(isbn(9460), 'Libro de la colección', { coleccion_id: id });
        await crearLibro(isbn(9461), 'Libro sin colección');

        const res = await auth(request(app).get(`/coleccion/${id}/libros`));

        expectList(res);
        expect(res.body.items).toHaveLength(1);
        const libro = res.body.items[0];
        expect(libro).toMatchObject({ isbn: isbn(9460), titulo: 'Libro de la colección', precio: 10000 });
        expect(libro).toHaveProperty('portada_url');
        expect(res.body.pagination.total).toEqual(1);
    });

    it('un libro de otra colección no aparece', async () => {
        const a = await crearColeccion('Listado A');
        const b = await crearColeccion('Listado B');
        await crearLibro(isbn(9462), 'Libro en A', { coleccion_id: a.body.data.id });
        await crearLibro(isbn(9463), 'Libro en B', { coleccion_id: b.body.data.id });

        const res = await auth(request(app).get(`/coleccion/${a.body.data.id}/libros`));

        expect(res.body.items.map((l: { isbn: string }) => l.isbn)).toContain(isbn(9462));
        expect(res.body.items.map((l: { isbn: string }) => l.isbn)).not.toContain(isbn(9463));
    });

    it('pagina con las convenciones de GET /libro y el total cuenta sólo la colección', async () => {
        const creada = await crearColeccion('Listado paginado');
        const id = creada.body.data.id;
        await crearLibro(isbn(9470), 'Paginado uno', { coleccion_id: id });
        await crearLibro(isbn(9471), 'Paginado dos', { coleccion_id: id });
        await crearLibro(isbn(9472), 'Paginado tres');

        const res = await auth(request(app).get(`/coleccion/${id}/libros?page=1&pageSize=1`));

        expect(res.status).toEqual(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 1, total: 2, count: 1 });
    });

    it('mover un libro lo saca de la colección anterior y lo agrega a la nueva', async () => {
        const a = await crearColeccion('Mover desde');
        const b = await crearColeccion('Mover hacia');
        const isbnLibro = isbn(9473);
        await crearLibro(isbnLibro, 'Libro a mover', { coleccion_id: a.body.data.id });

        await auth(request(app).put(`/libro/${isbnLibro}`).send({ coleccion_id: b.body.data.id }));

        const enA = await auth(request(app).get(`/coleccion/${a.body.data.id}/libros`));
        expect(enA.body.items).toHaveLength(0);

        const enB = await auth(request(app).get(`/coleccion/${b.body.data.id}/libros`));
        expect(enB.body.items.map((l: { isbn: string }) => l.isbn)).toContain(isbnLibro);
    });

    it('id inexistente devuelve 404', async () => {
        const res = await auth(request(app).get('/coleccion/999999/libros'));
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });

    it('de otro usuario devuelve 404', async () => {
        const creada = await crearColeccion('Listado ajeno');

        const res = await auth(request(app).get(`/coleccion/${creada.body.data.id}/libros`), otroToken);
        expectNotFound(res);
        expect(res.body.success).toEqual(false);
    });
});

describe('GET /libro?sin_coleccion', () => {
    const marca = 'SCMA';
    const isbn1 = isbn(9480);
    const isbn2 = isbn(9481);
    const isbn3 = isbn(9482);
    const titulo1 = `Uno ${marca}`;
    const titulo2 = `Dos ${marca}`;
    const titulo3 = `Tres ${marca}`;

    beforeAll(async () => {
        const coleccion = await crearColeccion('Colección sin_coleccion');
        await crearLibro(isbn1, titulo1, { coleccion_id: coleccion.body.data.id });
        await crearLibro(isbn2, titulo2, { coleccion_id: coleccion.body.data.id });
        await crearLibro(isbn3, titulo3);
    });

    it('sin_coleccion=true no devuelve libros que pertenecen a una colección', async () => {
        const res = await auth(request(app).get('/libro?sin_coleccion=true&pageSize=100'));

        expectList(res);
        for (const libro of res.body.items) {
            expect(libro.coleccion_id).toBeNull();
        }
    });

    it('el total cuenta sólo los libros sin colección de la combinación con título', async () => {
        const res = await auth(request(app).get(`/libro?sin_coleccion=true&titulo=${marca}`));

        expectList(res);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].isbn).toEqual(isbn3);
        expect(res.body.pagination.total).toEqual(1);
    });

    it('se combina con isbn (igualdad)', async () => {
        const sin = await auth(request(app).get(`/libro?sin_coleccion=true&isbn=${isbn3}`));
        expect(sin.body.pagination.total).toEqual(1);

        const con = await auth(request(app).get(`/libro?sin_coleccion=true&isbn=${isbn1}`));
        expect(con.body.items).toHaveLength(0);
        expect(con.body.pagination.total).toEqual(0);
    });

    it('sin sin_coleccion el catálogo se comporta como hoy (incluye los asignados)', async () => {
        const res = await auth(request(app).get(`/libro?titulo=${marca}`));

        expectList(res);
        expect(res.body.pagination.total).toEqual(3);
    });

    it('al asignar a una colección un libro buscado, deja de aparecer y el total baja', async () => {
        const coleccion = await crearColeccion('Colección que absorbe');
        await auth(request(app).put(`/libro/${isbn3}`).send({ coleccion_id: coleccion.body.data.id }));

        const res = await auth(request(app).get(`/libro?sin_coleccion=true&titulo=${marca}`));

        expect(res.body.items).toHaveLength(0);
        expect(res.body.pagination.total).toEqual(0);
    });
});

describe('seeder de colecciones', () => {
    it('deja las 3 colecciones de muestra sin libros ni portada', async () => {
        const res = await auth(request(app).get('/coleccion/'));

        const titulos = res.body.data.map((c: { titulo: string }) => c.titulo);
        expect(titulos).toEqual(
            expect.arrayContaining(['Clásicos recuperados', 'Serie Aljibe', 'Álbum ilustrado'])
        );

        for (const titulo of ['Clásicos recuperados', 'Serie Aljibe', 'Álbum ilustrado']) {
            const coleccion = res.body.data.find((c: { titulo: string }) => c.titulo === titulo);
            expect(coleccion.cantidad_libros).toEqual(0);
            expect(coleccion.portada_url).toBeNull();
            expect(coleccion.descripcion).toBeTruthy();
        }
    });

    it('correr el seeder dos veces no duplica', async () => {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.username, 'libreria_sur'));
        const storage = createLocalStorage({ basePath: env.FILES_PATH, host: env.HOST });
        const modulo = createColeccionModule({ db, storage });

        await seedColecciones([{ id: user.id } as never], modulo.service);

        const colecciones = await modulo.service.findAll(user.id);
        const titulos = colecciones.map((c) => c.titulo);
        expect(titulos.filter((t) => t === 'Clásicos recuperados')).toHaveLength(1);
        expect(titulos.filter((t) => t === 'Serie Aljibe')).toHaveLength(1);
        expect(titulos.filter((t) => t === 'Álbum ilustrado')).toHaveLength(1);
    });
});
