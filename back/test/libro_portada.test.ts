import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectBadRequest, expectCreated, expectUpdated, expectNotFound } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn } from '../seeders/data';

// Recipe fija de `seeders/libros.seeder.ts`: 12 libros por usuario,
// isbn(índice global). `libreria_sur` es el primer usuario seedeado, así
// que sus libros son isbn(0)..isbn(11) y nunca tienen los campos extendidos
// cargados (el seeder no los setea).
const ISBN_LIBRO_1 = isbn(0);

// PNG 1x1 válido (no importa el contenido real: la validación de tipo se
// basa en el `Content-Type` declarado por el cliente, igual que
// `user.service.ts#uploadCert`), sirve tanto para "es una imagen" como para
// tener bytes reales que devolver por `GET /files/...`.
const PNG_1X1 = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082",
    "hex"
);

let token: string;

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

// Extrae el path relativo (`/files/...`) de la URL absoluta que devuelve la
// API: los tests pegan contra `app` (supertest, sin red real), no contra
// `env.HOST`.
function pathnameOf(url: string): string {
    return new URL(url).pathname;
}

describe('campos extendidos de libro', () => {
    it('un libro seedeado (creado antes de este cambio) devuelve los campos nuevos en null', async () => {
        const res = await request(app)
            .get(`/libro/${ISBN_LIBRO_1}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.data.alto).toBeNull();
        expect(res.body.data.ancho).toBeNull();
        expect(res.body.data.largo).toBeNull();
        expect(res.body.data.paginas).toBeNull();
        expect(res.body.data.brief).toBeNull();
        expect(res.body.data.edad_recomendada).toBeNull();
        expect(res.body.data.book_trailer_url).toBeNull();
        expect(res.body.data.portada_url).toBeNull();
    });

    describe('POST /libro', () => {
        it('crea un libro con todos los campos extendidos cargados y los devuelve tal cual', async () => {
            const res = await request(app)
                .post('/libro/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    isbn: isbn(9101),
                    titulo: 'Libro con campos extendidos',
                    fecha_edicion: '2020-02-17',
                    precio: 10000,
                    stock: 0,
                    alto: 20.5,
                    ancho: 15.2,
                    largo: 2.1,
                    paginas: 320,
                    brief: 'Una novela de prueba',
                    edad_recomendada: 12,
                    book_trailer_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                });

            expectCreated(res);
            expect(res.body.data.alto).toEqual(20.5);
            expect(res.body.data.ancho).toEqual(15.2);
            expect(res.body.data.largo).toEqual(2.1);
            expect(res.body.data.paginas).toEqual(320);
            expect(res.body.data.brief).toEqual('Una novela de prueba');
            expect(res.body.data.edad_recomendada).toEqual(12);
            expect(res.body.data.book_trailer_url).toEqual('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            expect(res.body.data.portada_url).toBeNull();
        });

        it('crea un libro sin ninguno de los campos extendidos: 201 y todo en null', async () => {
            const res = await request(app)
                .post('/libro/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    isbn: isbn(9102),
                    titulo: 'Libro sin campos extendidos',
                    fecha_edicion: '2020-02-17',
                    precio: 10000,
                    stock: 0
                });

            expectCreated(res);
            expect(res.body.data.alto).toBeNull();
            expect(res.body.data.paginas).toBeNull();
            expect(res.body.data.book_trailer_url).toBeNull();
            expect(res.body.data.portada_url).toBeNull();
        });

        it.each(['alto', 'ancho', 'largo', 'paginas'])('rechaza %s en 0 o negativo con 400', async (campo) => {
            const res = await request(app)
                .post('/libro/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    isbn: isbn(9103),
                    titulo: 'Libro inválido',
                    fecha_edicion: '2020-02-17',
                    precio: 10000,
                    stock: 0,
                    [campo]: campo === 'paginas' ? 0 : -1
                });

            expectBadRequest(res);
        });

        it('rechaza un book_trailer_url que no matchea un link de YouTube válido', async () => {
            const res = await request(app)
                .post('/libro/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    isbn: isbn(9104),
                    titulo: 'Libro con trailer inválido',
                    fecha_edicion: '2020-02-17',
                    precio: 10000,
                    stock: 0,
                    book_trailer_url: 'https://vimeo.com/12345'
                });

            expectBadRequest(res);
        });

        it('acepta book_trailer_url vacío u omitido sin fallar', async () => {
            const res = await request(app)
                .post('/libro/')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    isbn: isbn(9105),
                    titulo: 'Libro con trailer vacío',
                    fecha_edicion: '2020-02-17',
                    precio: 10000,
                    stock: 0,
                    book_trailer_url: ''
                });

            expectCreated(res);
            expect(res.body.data.book_trailer_url).toEqual('');
        });
    });

    describe('PUT /libro/:isbn', () => {
        it('carga por primera vez los campos extendidos y los devuelve', async () => {
            const res = await request(app)
                .put(`/libro/${isbn(9102)}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ alto: 10, ancho: 8, largo: 1, paginas: 100, edad_recomendada: 6 });

            expectUpdated(res);
            expect(res.body.data.alto).toEqual(10);
            expect(res.body.data.paginas).toEqual(100);
            expect(res.body.data.edad_recomendada).toEqual(6);
        });

        it('reemplaza valores ya cargados por otros nuevos', async () => {
            const res = await request(app)
                .put(`/libro/${isbn(9102)}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ alto: 99, paginas: 555 });

            expectUpdated(res);
            expect(res.body.data.alto).toEqual(99);
            expect(res.body.data.paginas).toEqual(555);
            // Lo que no se tocó en este PUT sigue como quedó antes.
            expect(res.body.data.ancho).toEqual(8);
        });

        it('aplica las mismas validaciones que la creación', async () => {
            const res = await request(app)
                .put(`/libro/${isbn(9102)}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ paginas: -5 });

            expectBadRequest(res);
        });

        it('rechaza un book_trailer_url inválido al editar', async () => {
            const res = await request(app)
                .put(`/libro/${isbn(9102)}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ book_trailer_url: 'no-es-un-link' });

            expectBadRequest(res);
        });
    });

    describe('listado y detalle incluyen los campos nuevos', () => {
        it('GET /libro incluye los campos extendidos por cada libro', async () => {
            const res = await request(app)
                .get('/libro')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toEqual(200);
            expect(res.body.items.length).toBeGreaterThan(0);
            for (const libro of res.body.items) {
                expect(libro).toHaveProperty('alto');
                expect(libro).toHaveProperty('paginas');
                expect(libro).toHaveProperty('book_trailer_url');
                expect(libro).toHaveProperty('portada_url');
            }
        });

        it('GET /libro/lista_libros incluye los campos extendidos por cada libro', async () => {
            const res = await request(app)
                .get('/libro/lista_libros')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toEqual(200);
            expect(res.text).toContain('portada_url');
            expect(res.text).toContain('book_trailer_url');
        });
    });
});

describe('POST /libro/:isbn/portada', () => {
    const ISBN_PORTADA = isbn(9106);

    beforeAll(async () => {
        await request(app)
            .post('/libro/')
            .set('Authorization', `Bearer ${token}`)
            .send({
                isbn: ISBN_PORTADA,
                titulo: 'Libro para portada',
                fecha_edicion: '2020-02-17',
                precio: 10000,
                stock: 0
            });
    });

    it('sin archivo devuelve 400', async () => {
        const res = await request(app)
            .post(`/libro/${ISBN_PORTADA}/portada`)
            .set('Authorization', `Bearer ${token}`);

        expectBadRequest(res);
    });

    it('isbn inexistente devuelve 404', async () => {
        const res = await request(app)
            .post(`/libro/${ISBN_PORTADA}999/portada`)
            .set('Authorization', `Bearer ${token}`)
            .attach('portada', PNG_1X1, { filename: 'portada.png', contentType: 'image/png' });

        expectNotFound(res);
    });

    it('un tipo de archivo distinto a JPG/PNG devuelve 415 y no modifica el libro', async () => {
        const antes = await request(app)
            .get(`/libro/${ISBN_PORTADA}`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .post(`/libro/${ISBN_PORTADA}/portada`)
            .set('Authorization', `Bearer ${token}`)
            .attach('portada', Buffer.from('%PDF-1.4'), { filename: 'archivo.pdf', contentType: 'application/pdf' });

        expect(res.status).toEqual(415);
        expect(res.body.success).toEqual(false);

        const despues = await request(app)
            .get(`/libro/${ISBN_PORTADA}`)
            .set('Authorization', `Bearer ${token}`);

        expect(despues.body.data.portada_url).toEqual(antes.body.data.portada_url);
    });

    it('un archivo de más de 5 MB devuelve 413 y no modifica el libro', async () => {
        const archivoGrande = Buffer.alloc(5 * 1024 * 1024 + 1, 1);

        const res = await request(app)
            .post(`/libro/${ISBN_PORTADA}/portada`)
            .set('Authorization', `Bearer ${token}`)
            .attach('portada', archivoGrande, { filename: 'grande.png', contentType: 'image/png' });

        expect(res.status).toEqual(413);
        expect(res.body.success).toEqual(false);
    });

    it('subir una imagen válida a un libro sin portada devuelve 200 con portada_url no nulo, y la url sirve la imagen', async () => {
        const res = await request(app)
            .post(`/libro/${ISBN_PORTADA}/portada`)
            .set('Authorization', `Bearer ${token}`)
            .attach('portada', PNG_1X1, { filename: 'portada.png', contentType: 'image/png' });

        expect(res.status).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.portada_url).not.toBeNull();

        const imagen = await request(app).get(pathnameOf(res.body.data.portada_url));
        expect(imagen.status).toEqual(200);
        expect(imagen.headers['content-type']).toContain('image/');
    });

    it('subir una segunda imagen reemplaza la portada: la url cambia y la vieja deja de servir', async () => {
        const primera = await request(app)
            .get(`/libro/${ISBN_PORTADA}`)
            .set('Authorization', `Bearer ${token}`);
        const urlVieja = primera.body.data.portada_url;

        const res = await request(app)
            .post(`/libro/${ISBN_PORTADA}/portada`)
            .set('Authorization', `Bearer ${token}`)
            .attach('portada', PNG_1X1, { filename: 'portada2.jpg', contentType: 'image/jpeg' });

        expect(res.status).toEqual(200);
        const urlNueva = res.body.data.portada_url;
        expect(urlNueva).not.toEqual(urlVieja);

        const viejaRes = await request(app).get(pathnameOf(urlVieja));
        expect(viejaRes.status).toEqual(404);

        const nuevaRes = await request(app).get(pathnameOf(urlNueva));
        expect(nuevaRes.status).toEqual(200);
    });
});
