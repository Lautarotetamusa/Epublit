import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectBadRequest, expectCreated, expectUpdated, expectNotFound } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { dni } from '../seeders/data';

// Recipe fija de `seeders/personas.seeder.ts`: 6 personas por usuario,
// dni(índice global). `libreria_sur` es el primer usuario seedeado, así que
// sus personas son dni(0)..dni(5) y nunca tienen bio/foto cargadas (el
// seeder no las setea).
const DNI_PERSONA_SEEDEADA = dni(0);

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

async function crearPersona(datos: Record<string, unknown> = {}) {
    const res = await request(app)
        .post('/persona/')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Persona de prueba', dni: dni(Math.floor(Math.random() * 1000000) + 20000), ...datos });

    expectCreated(res);
    return res.body.data;
}

// PNG "falso" (header IHDR real, sin datos de imagen reales): alcanza para
// probar tipo/tamaño/resolución porque `getImageSize` sólo lee el header, y
// `express.static` sólo sirve bytes sin decodificarlos (mismo criterio que
// `libro_portada.test.ts#PNG_1X1`, un poco más simple porque acá se
// necesita controlar el ancho/alto exactos para los tests de resolución).
function buildPngBuffer(width: number, height: number, paddingBytes = 0): Buffer {
    const signature = Buffer.from("89504e470d0a1a0a", "hex");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(13, 0);
    const type = Buffer.from("IHDR");
    const dims = Buffer.alloc(8);
    dims.writeUInt32BE(width, 0);
    dims.writeUInt32BE(height, 4);
    const rest = Buffer.alloc(5 + 4); // bitdepth/colortype/compression/filter/interlace + CRC, contenido irrelevante
    const padding = Buffer.alloc(paddingBytes);
    return Buffer.concat([signature, length, type, dims, rest, padding]);
}

const PNG_100X100 = buildPngBuffer(100, 100);

describe('bio de persona', () => {
    it('una persona seedeada (creada antes de este cambio) devuelve bio en null', async () => {
        const listado = await request(app)
            .get('/persona?pageSize=100')
            .set('Authorization', `Bearer ${token}`);
        const persona = listado.body.items.find((p: { dni: string }) => p.dni === DNI_PERSONA_SEEDEADA);

        const res = await request(app)
            .get(`/persona/${persona.id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.data.bio).toBeNull();
    });

    it('crea una persona con bio cargada y la devuelve tal cual', async () => {
        const persona = await crearPersona({ bio: 'Biografía de prueba' });
        expect(persona.bio).toEqual('Biografía de prueba');
    });

    it('crea una persona sin bio: 201 y bio en null', async () => {
        const persona = await crearPersona();
        expect(persona.bio).toBeNull();
    });

    it('edita una persona para cargar bio por primera vez', async () => {
        const persona = await crearPersona();

        const res = await request(app)
            .put(`/persona/${persona.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ bio: 'Bio cargada en la edición' });

        expectUpdated(res);
        expect(res.body.data.bio).toEqual('Bio cargada en la edición');
    });

    it('edita una persona que ya tenía bio y la reemplaza', async () => {
        const persona = await crearPersona({ bio: 'Bio original' });

        const res = await request(app)
            .put(`/persona/${persona.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ bio: 'Bio reemplazada' });

        expectUpdated(res);
        expect(res.body.data.bio).toEqual('Bio reemplazada');
    });

    it('GET /persona incluye bio por cada persona del listado', async () => {
        const res = await request(app)
            .get('/persona?pageSize=100')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.items.length).toBeGreaterThan(0);
        for (const persona of res.body.items) {
            expect(persona).toHaveProperty('bio');
        }
    });
});

describe('foto de persona', () => {
    it('una persona recién creada devuelve foto_url en null', async () => {
        const persona = await crearPersona();
        expect(persona.foto_url).toBeNull();
    });

    it('GET /persona incluye foto_url por cada persona del listado', async () => {
        const res = await request(app)
            .get('/persona?pageSize=100')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        for (const persona of res.body.items) {
            expect(persona).toHaveProperty('foto_url');
        }
    });

    describe('POST /persona/:id/foto', () => {
        it('sin archivo devuelve 400', async () => {
            const persona = await crearPersona();

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`);

            expectBadRequest(res);
        });

        it('id inexistente devuelve 404', async () => {
            const res = await request(app)
                .post('/persona/999999999/foto')
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', PNG_100X100, { filename: 'foto.png', contentType: 'image/png' });

            expectNotFound(res);
        });

        it('un tipo de archivo distinto a JPG/PNG devuelve 415 y no modifica la persona', async () => {
            const persona = await crearPersona();

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', Buffer.from('%PDF-1.4'), { filename: 'archivo.pdf', contentType: 'application/pdf' });

            expect(res.status).toEqual(415);
            expect(res.body.success).toEqual(false);

            const despues = await request(app)
                .get(`/persona/${persona.id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(despues.body.data.foto_url).toBeNull();
        });

        it('subir una imagen válida a una persona sin foto devuelve 200 con foto_url no nulo, y la url sirve la imagen', async () => {
            const persona = await crearPersona();

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', PNG_100X100, { filename: 'foto.png', contentType: 'image/png' });

            expect(res.status).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data.foto_url).not.toBeNull();

            const imagen = await request(app).get(pathnameOf(res.body.data.foto_url));
            expect(imagen.status).toEqual(200);
            expect(imagen.headers['content-type']).toContain('image/');
        });

        it('subir una segunda imagen reemplaza la foto: la url cambia y la vieja deja de servir', async () => {
            const persona = await crearPersona();

            const primera = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', PNG_100X100, { filename: 'foto.png', contentType: 'image/png' });
            const urlVieja = primera.body.data.foto_url;

            const segunda = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', PNG_100X100, { filename: 'foto2.jpg', contentType: 'image/jpeg' });

            expect(segunda.status).toEqual(200);
            const urlNueva = segunda.body.data.foto_url;
            expect(urlNueva).not.toEqual(urlVieja);

            const viejaRes = await request(app).get(pathnameOf(urlVieja));
            expect(viejaRes.status).toEqual(404);

            const nuevaRes = await request(app).get(pathnameOf(urlNueva));
            expect(nuevaRes.status).toEqual(200);
        });
    });

    describe('DELETE /persona/:id/foto', () => {
        it('id inexistente devuelve 404', async () => {
            const res = await request(app)
                .delete('/persona/999999999/foto')
                .set('Authorization', `Bearer ${token}`);

            expectNotFound(res);
        });

        it('quitar la foto de una persona que no tenía foto devuelve 200 con foto_url en null', async () => {
            const persona = await crearPersona();

            const res = await request(app)
                .delete(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toEqual(200);
            expect(res.body.data.foto_url).toBeNull();
        });

        it('quitar la foto de una persona que tenía una la deja en null y la url anterior deja de servir', async () => {
            const persona = await crearPersona();

            const subida = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', PNG_100X100, { filename: 'foto.png', contentType: 'image/png' });
            const urlVieja = subida.body.data.foto_url;

            const res = await request(app)
                .delete(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toEqual(200);
            expect(res.body.data.foto_url).toBeNull();

            const viejaRes = await request(app).get(pathnameOf(urlVieja));
            expect(viejaRes.status).toEqual(404);
        });
    });
});

describe('restricciones de foto configuradas por el usuario', () => {
    afterAll(async () => {
        // No deja configuración residual para otros archivos de test que
        // reusen el mismo usuario seedeado (`libreria_sur`).
        await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({
                foto_persona_max_size_mb: null,
                foto_persona_min_ancho_px: null,
                foto_persona_min_alto_px: null
            });
    });

    it('GET /user sin configurar estos campos los devuelve en null', async () => {
        const res = await request(app).get('/user').set('Authorization', `Bearer ${token}`);

        expect(res.status).toEqual(200);
        expect(res.body.data.foto_persona_max_size_mb).toBeNull();
        expect(res.body.data.foto_persona_min_ancho_px).toBeNull();
        expect(res.body.data.foto_persona_min_alto_px).toBeNull();
    });

    it('guardar sólo uno de los tres campos no falla y no toca los otros', async () => {
        const res = await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({ foto_persona_max_size_mb: 2 });

        expectUpdated(res);
        expect(res.body.data.foto_persona_max_size_mb).toEqual(2);
        expect(res.body.data.foto_persona_min_ancho_px).toBeNull();
        expect(res.body.data.foto_persona_min_alto_px).toBeNull();
    });

    it('actualiza los tres campos por primera vez y los persiste', async () => {
        const res = await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({
                foto_persona_max_size_mb: 1,
                foto_persona_min_ancho_px: 300,
                foto_persona_min_alto_px: 400
            });

        expectUpdated(res);
        expect(res.body.data.foto_persona_max_size_mb).toEqual(1);
        expect(res.body.data.foto_persona_min_ancho_px).toEqual(300);
        expect(res.body.data.foto_persona_min_alto_px).toEqual(400);

        const get = await request(app).get('/user').set('Authorization', `Bearer ${token}`);
        expect(get.body.data.foto_persona_max_size_mb).toEqual(1);
        expect(get.body.data.foto_persona_min_ancho_px).toEqual(300);
        expect(get.body.data.foto_persona_min_alto_px).toEqual(400);
    });

    it('mandar null en un campo previamente configurado lo vuelve a dejar sin límite', async () => {
        const res = await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({ foto_persona_max_size_mb: null });

        expectUpdated(res);
        expect(res.body.data.foto_persona_max_size_mb).toBeNull();
        // Los otros dos, no tocados en este PUT, siguen configurados.
        expect(res.body.data.foto_persona_min_ancho_px).toEqual(300);
        expect(res.body.data.foto_persona_min_alto_px).toEqual(400);
    });

    describe('tamaño máximo aplicado a POST /persona/:id/foto', () => {
        it('con tamaño máximo configurado, un archivo que lo supera devuelve 413 y no modifica la persona', async () => {
            await request(app)
                .put('/user')
                .set('Authorization', `Bearer ${token}`)
                .send({ foto_persona_max_size_mb: 1, foto_persona_min_ancho_px: null, foto_persona_min_alto_px: null });

            const persona = await crearPersona();
            const archivoGrande = buildPngBuffer(100, 100, 1024 * 1024 + 1);

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', archivoGrande, { filename: 'grande.png', contentType: 'image/png' });

            expect(res.status).toEqual(413);
            expect(res.body.success).toEqual(false);

            const despues = await request(app)
                .get(`/persona/${persona.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(despues.body.data.foto_url).toBeNull();
        });

        it('con tamaño máximo configurado, un archivo que no lo supera devuelve 200', async () => {
            const persona = await crearPersona();

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', PNG_100X100, { filename: 'chico.png', contentType: 'image/png' });

            expect(res.status).toEqual(200);
        });

        it('sin tamaño máximo configurado, un archivo de cualquier peso no devuelve 413 por este motivo', async () => {
            await request(app)
                .put('/user')
                .set('Authorization', `Bearer ${token}`)
                .send({ foto_persona_max_size_mb: null });

            const persona = await crearPersona();
            const archivoGrande = buildPngBuffer(100, 100, 2 * 1024 * 1024);

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', archivoGrande, { filename: 'grande.png', contentType: 'image/png' });

            expect(res.status).toEqual(200);
        });
    });

    describe('resolución mínima aplicada a POST /persona/:id/foto', () => {
        it('con ancho/alto mínimo configurado, una imagen más chica devuelve 422 y no modifica la persona', async () => {
            await request(app)
                .put('/user')
                .set('Authorization', `Bearer ${token}`)
                .send({ foto_persona_min_ancho_px: 300, foto_persona_min_alto_px: 400 });

            const persona = await crearPersona();
            const imagenChica = buildPngBuffer(100, 100);

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', imagenChica, { filename: 'chica.png', contentType: 'image/png' });

            expect(res.status).toEqual(422);
            expect(res.body.success).toEqual(false);

            const despues = await request(app)
                .get(`/persona/${persona.id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(despues.body.data.foto_url).toBeNull();
        });

        it('con ancho/alto mínimo configurado, una imagen que cumple el mínimo devuelve 200', async () => {
            const persona = await crearPersona();
            const imagenGrande = buildPngBuffer(300, 400);

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', imagenGrande, { filename: 'grande.png', contentType: 'image/png' });

            expect(res.status).toEqual(200);
        });

        it('sin resolución mínima configurada, una imagen de cualquier tamaño no devuelve 422 por este motivo', async () => {
            await request(app)
                .put('/user')
                .set('Authorization', `Bearer ${token}`)
                .send({ foto_persona_min_ancho_px: null, foto_persona_min_alto_px: null });

            const persona = await crearPersona();
            const imagenChica = buildPngBuffer(10, 10);

            const res = await request(app)
                .post(`/persona/${persona.id}/foto`)
                .set('Authorization', `Bearer ${token}`)
                .attach('foto', imagenChica, { filename: 'chica.png', contentType: 'image/png' });

            expect(res.status).toEqual(200);
        });
    });
});
