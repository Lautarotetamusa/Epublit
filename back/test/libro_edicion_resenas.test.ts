import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectBadRequest, expectCreated, expectNotFound, expectUpdated, getRolId } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { dni, isbn } from '../seeders/data';

// Ver specs/022-libro-edicion-visibilidad-resenas.
const ORIGEN = 'https://tienda-visibilidad.test';
const ISBN_VISIBLE = isbn(9640);
const ISBN_OCULTO = isbn(9641);

let token: string;
let otroToken: string;
let apiKey: string;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

const publica = (path: string) =>
    request(app).get(`/public/tienda/v1${path}`).set('X-API-Key', apiKey).set('Origin', ORIGEN);

const crearLibro = async (isbnLibro: string, titulo: string, extra: Record<string, unknown> = {}) => {
    const res = await auth(
        request(app).post('/libro/').send({ isbn: isbnLibro, titulo, fecha_edicion: '2021-05-10', precio: 9000, ...extra })
    );
    expectCreated(res);
    return res.body.data;
};

beforeAll(async () => {
    token = (await request(app).post('/user/login').send({ identifier: 'libreria_sur', password: PASSWORD_SEED })).body.token;
    otroToken = (await request(app).post('/user/login').send({ identifier: 'editorial_norte', password: PASSWORD_SEED })).body.token;

    const integracion = await auth(request(app).post('/integraciones').send({ nombre: 'Visibilidad', origen: ORIGEN }));
    expectCreated(integracion);
    apiKey = integracion.body.data.apiKey;

    await crearLibro(ISBN_VISIBLE, 'Libro visible en el sitio');
    await crearLibro(ISBN_OCULTO, 'Libro oculto en el sitio', { visible: false, tipo_edicion: 'pop_up' });

    const autora = await auth(request(app).post('/persona/').send({ nombre: 'Autora Solo Oculta', dni: dni(9640) }));
    expectCreated(autora);
    const rolAutor = await getRolId(app, token, 'autor');
    expectCreated(
        await auth(request(app).post(`/libro/${ISBN_OCULTO}/personas`).send({ id_persona: autora.body.data.id, rol: rolAutor, porcentaje: 10 }))
    );
});

afterAll(async () => {
    await auth(request(app).delete(`/libro/${ISBN_VISIBLE}`));
    await auth(request(app).delete(`/libro/${ISBN_OCULTO}`));
    db.$client.end();
    server.close();
});

describe('tipo de edición y visibilidad', () => {
    it('por defecto un libro es normal y visible', async () => {
        const res = await auth(request(app).get(`/libro/${ISBN_VISIBLE}`));
        expect(res.body.data.tipo_edicion).toEqual('normal');
        expect(res.body.data.visible).toEqual(true);
    });

    it('acepta cambiar el tipo de edición', async () => {
        const res = await auth(request(app).put(`/libro/${ISBN_VISIBLE}`).send({ tipo_edicion: 'cartone' }));
        expectUpdated(res);
        expect(res.body.data.tipo_edicion).toEqual('cartone');
    });

    it('un tipo de edición desconocido es 400', async () => {
        expectBadRequest(await auth(request(app).put(`/libro/${ISBN_VISIBLE}`).send({ tipo_edicion: 'tapa_dura' })));
    });

    it('el panel sigue listando el libro oculto', async () => {
        const res = await auth(request(app).get(`/libro?isbn=${ISBN_OCULTO}`));
        expect(res.body.items.map((l: { isbn: string }) => l.isbn)).toContain(ISBN_OCULTO);
    });

    it('el sitio no lista el libro oculto', async () => {
        const res = await publica('/libros?porPagina=100');
        const isbns = res.body.libros.map((l: { isbn: string }) => l.isbn);
        expect(isbns).toContain(ISBN_VISIBLE);
        expect(isbns).not.toContain(ISBN_OCULTO);
    });

    it('el detalle de un libro oculto en el sitio es 404', async () => {
        expect((await publica(`/libros/${ISBN_OCULTO}`)).status).toEqual(404);
    });

    it('una persona con sólo libros ocultos no aparece en Autorxs', async () => {
        const res = await publica('/personas');
        expect(res.body.personas.map((p: { nombre: string }) => p.nombre)).not.toContain('Autora Solo Oculta');
    });
});

describe('reseñas', () => {
    let resenaId: number;

    it('una URL inválida es 400', async () => {
        expectBadRequest(await auth(request(app).post(`/libro/${ISBN_VISIBLE}/resenas`).send({ url: 'no-es-url' })));
        expectBadRequest(await auth(request(app).post(`/libro/${ISBN_VISIBLE}/resenas`).send({ url: 'ftp://reseñas.test/a' })));
    });

    it('crea una reseña y la lista', async () => {
        const res = await auth(request(app).post(`/libro/${ISBN_VISIBLE}/resenas`).send({ url: 'https://diario.test/resena-1' }));
        expectCreated(res);
        resenaId = res.body.data.id;

        const lista = await auth(request(app).get(`/libro/${ISBN_VISIBLE}/resenas`));
        expect(lista.status).toEqual(200);
        expect(lista.body.data.map((r: { url: string }) => r.url)).toEqual(['https://diario.test/resena-1']);
    });

    it('el detalle público expone las reseñas y el tipo de edición', async () => {
        const res = await publica(`/libros/${ISBN_VISIBLE}`);
        expect(res.body.resenas).toEqual([{ url: 'https://diario.test/resena-1' }]);
        expect(res.body.tipoEdicion).toEqual('cartone');
    });

    it('edita la reseña', async () => {
        const res = await auth(request(app).put(`/libro/${ISBN_VISIBLE}/resenas/${resenaId}`).send({ url: 'https://diario.test/resena-editada' }));
        expectUpdated(res);
        expect(res.body.data.url).toEqual('https://diario.test/resena-editada');
    });

    it('otra cuenta no puede editar ni borrar la reseña', async () => {
        expectNotFound(
            await auth(request(app).put(`/libro/${ISBN_VISIBLE}/resenas/${resenaId}`).send({ url: 'https://x.test' }), otroToken)
        );
        expectNotFound(await auth(request(app).delete(`/libro/${ISBN_VISIBLE}/resenas/${resenaId}`), otroToken));
    });

    it('una reseña de otro libro es 404', async () => {
        expectNotFound(await auth(request(app).delete(`/libro/${ISBN_OCULTO}/resenas/${resenaId}`)));
    });

    it('borra la reseña', async () => {
        const res = await auth(request(app).delete(`/libro/${ISBN_VISIBLE}/resenas/${resenaId}`));
        expect(res.status).toEqual(200);

        const lista = await auth(request(app).get(`/libro/${ISBN_VISIBLE}/resenas`));
        expect(lista.body.data).toEqual([]);
    });
});
