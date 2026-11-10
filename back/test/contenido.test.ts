import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectCreated } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';

const ORIGEN = 'https://contenido-landing.test';

let token: string;
let otroToken: string;
let apiKey: string;
let otroApiKey: string;
let secuencia = 0;

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

const slugUnico = (base: string): string => {
    secuencia += 1;
    return `${base}-${secuencia}`;
};

const crearIntegracion = async (nombre: string, origen: string, t = token): Promise<string> => {
    const res = await auth(request(app).post('/integraciones').send({ nombre, origen }), t);
    expectCreated(res);
    return res.body.data.apiKey as string;
};

const publica = (path: string, key = apiKey, origin: string | null = ORIGEN) => {
    const req = request(app)
        .get(`/public/tienda/v1/contenido${path}`)
        .set('X-API-Key', key);

    return origin === null ? req : req.set('Origin', origin);
};

const crearPagina = (body: Record<string, unknown>, t = token) =>
    auth(request(app).post('/contenido/paginas').send(body), t);

const actualizarPagina = (id: number, body: Record<string, unknown>, t = token) =>
    auth(request(app).put(`/contenido/paginas/${id}`).send(body), t);

const publicarPagina = (id: number, t = token) =>
    auth(request(app).post(`/contenido/paginas/${id}/publicar`), t);

const despublicarPagina = (id: number, t = token) =>
    auth(request(app).post(`/contenido/paginas/${id}/despublicar`), t);

const borrarPagina = (id: number, t = token) =>
    auth(request(app).delete(`/contenido/paginas/${id}`), t);

// PNG válido con las dimensiones del header: alcanza para el detector y para
// los límites de resolución del CMS.
function pngDe(ancho: number, alto: number): Buffer {
    const firma = Buffer.from("89504e470d0a1a0a", "hex");
    const cabecera = Buffer.alloc(13);
    cabecera.writeUInt32BE(ancho, 0);
    cabecera.writeUInt32BE(alto, 4);
    cabecera[8] = 8;
    cabecera[9] = 2;

    const chunk = (tipo: string, datos: Buffer): Buffer => {
        const largo = Buffer.alloc(4);
        largo.writeUInt32BE(datos.length);
        return Buffer.concat([
            largo,
            Buffer.from(tipo, "ascii"),
            datos,
            Buffer.alloc(4)
        ]);
    };

    return Buffer.concat([firma, chunk("IHDR", cabecera), chunk("IEND", Buffer.alloc(0))]);
}

// WebP extendido (VP8X) mínimo: header RIFF/WEBP y el canvas en 24 bits.
function webpDe(ancho: number, alto: number): Buffer {
    const datos = Buffer.alloc(10);
    datos.writeUIntLE(ancho - 1, 4, 3);
    datos.writeUIntLE(alto - 1, 7, 3);

    const chunk = Buffer.concat([
        Buffer.from("VP8X", "ascii"),
        Buffer.from([10, 0, 0, 0]),
        datos
    ]);

    const header = Buffer.alloc(12);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(4 + chunk.length, 4);
    header.write("WEBP", 8, "ascii");

    return Buffer.concat([header, chunk]);
}

const subirImagen = (uso: string, buffer: Buffer, nombre = "imagen.png", mime = "image/png", t = token) =>
    auth(
        request(app)
            .post('/contenido/imagenes')
            .field('uso', uso)
            .attach('archivo', buffer, { filename: nombre, contentType: mime }),
        t
    );

const pathnameOf = (url: string): string => new URL(url).pathname;

function expectCreadoContenido(res: request.Response) {
    expect(res.status).toBe(201);
    expect(res.body.pagina ?? res.body.imagen).toBeDefined();
}

function expectContenidoNotFound(res: request.Response) {
    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toBe("no_encontrado");
}

async function expectPublicNotFound(promesa: request.Test) {
    const res = await promesa;
    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toBe("no_encontrado");
}

async function imagenDe(uso: "portada" | "bloque", ancho: number, alto: number, t = token) {
    const res = await subirImagen(uso, pngDe(ancho, alto), "imagen.png", "image/png", t);
    expect(res.status).toBe(201);
    return res.body.imagen as { id: number; url: string; ancho: number; alto: number };
}

beforeAll(async () => {
    const [res, otro] = await Promise.all([
        request(app).post('/user/login').send({ username: 'libreria_sur', password: PASSWORD_SEED }),
        request(app).post('/user/login').send({ username: 'editorial_norte', password: PASSWORD_SEED })
    ]);

    token = res.body.token;
    otroToken = otro.body.token;
    apiKey = await crearIntegracion('Contenido landing', ORIGEN);
    otroApiKey = await crearIntegracion('Contenido otra cuenta', ORIGEN, otroToken);
});

afterAll(() => {
    db.$client.end();
    server.close();
});

describe('imágenes del contenido', () => {
    it('sube una imagen de bloque, devuelve sus datos y la sirve sin sesión', async () => {
        const res = await subirImagen("bloque", pngDe(800, 450));
        expectCreadoContenido(res);
        expect(res.body.imagen).toMatchObject({
            ancho: 800,
            alto: 450,
            mime: "image/png",
            bytes: pngDe(800, 450).length
        });
        expect(res.body.imagen.url).toMatch(/^https?:\/\//);

        const archivo = await request(app).get(pathnameOf(res.body.imagen.url));
        expect(archivo.status).toBe(200);
    });

    it('acepta WebP válido por contenido', async () => {
        const res = await subirImagen("bloque", webpDe(800, 450), "imagen.webp", "image/webp");
        expectCreadoContenido(res);
        expect(res.body.imagen).toMatchObject({ mime: "image/webp", ancho: 800, alto: 450 });
    });

    it('exige 1200×600 para portada y hero', async () => {
        const res = await subirImagen("portada", pngDe(800, 450));
        expect(res.status).toBe(422);
        expect(res.body.error.codigo).toBe("resolucion_insuficiente");
    });

    it('rechaza un archivo que no es imagen aunque declare PNG', async () => {
        const res = await subirImagen("bloque", Buffer.from("no soy una imagen"), "falsa.png", "image/png");
        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe("archivo_invalido");
    });

    it('distingue un formato de imagen no permitido de un archivo ilegible', async () => {
        const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "binary");
        const res = await subirImagen("bloque", gif, "imagen.gif", "image/gif");
        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe("formato_no_permitido");
    });

    it('rechaza más de 8 MB con 413', async () => {
        const res = await subirImagen("bloque", Buffer.alloc(8 * 1024 * 1024 + 1));
        expect(res.status).toBe(413);
        expect(res.body.error.codigo).toBe("archivo_demasiado_grande");
    });

    it('exige un uso conocido', async () => {
        const res = await subirImagen("otro", pngDe(800, 450));
        expect(res.status).toBe(400);
    });

    it('no elimina una imagen referenciada por una página vigente', async () => {
        const imagen = await imagenDe("portada", 1200, 600);
        const pagina = await crearPagina({
            titulo: "Con portada",
            portada: { imagenId: imagen.id, textoAlternativo: "Portada" }
        });
        expectCreadoContenido(pagina);

        const res = await auth(request(app).delete(`/contenido/imagenes/${imagen.id}`));
        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("imagen_en_uso");
    });

    it('elimina una imagen sin uso y su URL deja de responder', async () => {
        const imagen = await imagenDe("bloque", 800, 450);
        const res = await auth(request(app).delete(`/contenido/imagenes/${imagen.id}`));

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ eliminada: true });

        const archivo = await request(app).get(pathnameOf(imagen.url));
        expect(archivo.status).toBe(404);
    });

    it('una imagen de otra cuenta devuelve 404 y sin sesión 401', async () => {
        const imagen = await imagenDe("bloque", 800, 450);

        const otra = await auth(request(app).delete(`/contenido/imagenes/${imagen.id}`), otroToken);
        expectContenidoNotFound(otra);

        const sinSesion = await request(app).delete(`/contenido/imagenes/${imagen.id}`);
        expect(sinSesion.status).toBe(401);
        expect(sinSesion.body.error.codigo).toBe("no_autenticado");
    });
});

describe('páginas: alta, listado y edición', () => {
    it('crea un borrador con valores por defecto', async () => {
        const res = await crearPagina({});

        expectCreadoContenido(res);
        expect(res.body.pagina).toMatchObject({
            titulo: "",
            slug: null,
            descripcion: null,
            estado: "borrador",
            visibleEnMenu: false,
            orden: 0,
            portada: null,
            bloques: [],
            actualizadaPor: "libreria_sur"
        });
        expect(res.body.pagina.id).toBeTypeOf("number");
        expect(res.body.pagina.actualizadaEn).toBeDefined();
    });

    it('lista, filtra y calcula conteos sobre la búsqueda', async () => {
        const base = slugUnico("listado");
        const publicada = await crearPagina({
            titulo: `Publicada ${base}`,
            slug: base,
            descripcion: "Descripción",
            bloques: [{ tipo: "texto", contenido: "Texto" }]
        });
        await publicarPagina(publicada.body.pagina.id);

        await crearPagina({ titulo: `Borrador ${base}`, slug: `${base}-b` });

        const todas = await auth(
            request(app).get('/contenido/paginas').query({ buscar: base })
        );
        expect(todas.status).toBe(200);
        expect(todas.body.total).toBe(2);
        expect(todas.body.conteos).toEqual({ todas: 2, publicadas: 1, borradores: 1 });

        const borradores = await auth(
            request(app).get('/contenido/paginas').query({ buscar: base, estado: "borradores" })
        );
        expect(borradores.body.total).toBe(1);
        expect(borradores.body.conteos).toEqual({ todas: 2, publicadas: 1, borradores: 1 });

        const invalido = await auth(
            request(app).get('/contenido/paginas').query({ estado: "otra" })
        );
        expect(invalido.status).toBe(400);
    });

    it('busca sin distinguir mayúsculas ni acentos y ordena por orden y título', async () => {
        const marca = slugUnico("premios");
        const primera = await crearPagina({ titulo: `Premiös ${marca}`, slug: `${marca}-a`, orden: 2 });
        const segunda = await crearPagina({ titulo: `Álbum ${marca}`, slug: `${marca}-b`, orden: 1 });
        expectCreadoContenido(primera);
        expectCreadoContenido(segunda);

        const res = await auth(request(app).get('/contenido/paginas').query({ buscar: "premios" }));
        expect(res.status).toBe(200);
        const propias = res.body.paginas.filter((p: { slug: string }) => p.slug?.startsWith(marca));
        expect(propias.map((p: { slug: string }) => p.slug)).toEqual([`${marca}-b`, `${marca}-a`]);
    });

    it('valida el slug y devuelve slug_duplicado', async () => {
        const slug = slugUnico("slug");
        expectCreadoContenido(await crearPagina({ titulo: "Uno", slug }));

        const duplicado = await crearPagina({ titulo: "Dos", slug });
        expect(duplicado.status).toBe(409);
        expect(duplicado.body.error.codigo).toBe("slug_duplicado");

        for (const invalido of ["Mayusculas", "con acento", "dos--guiones", "-borde", "borde-", "a_b"]) {
            const res = await crearPagina({ slug: invalido });
            expect(res.status).toBe(400);
            expect(res.body.error.codigo).toBe("slug_invalido");
        }
    });

    it('informa si un slug está libre, inválido u ocupado y excluye la propia página', async () => {
        const slug = slugUnico("disponible");
        const pagina = await crearPagina({ titulo: "Disponible", slug });
        const id = pagina.body.pagina.id as number;

        const libre = await auth(
            request(app).get('/contenido/paginas/slug-disponible').query({ slug: slugUnico("libre") })
        );
        expect(libre.body).toEqual({ disponible: true, motivo: "libre" });

        const invalido = await auth(
            request(app).get('/contenido/paginas/slug-disponible').query({ slug: "No valido" })
        );
        expect(invalido.body).toEqual({ disponible: false, motivo: "invalido" });

        const ocupado = await auth(
            request(app).get('/contenido/paginas/slug-disponible').query({ slug })
        );
        expect(ocupado.body).toEqual({ disponible: false, motivo: "en_uso" });

        const propia = await auth(
            request(app).get('/contenido/paginas/slug-disponible').query({ slug, paginaId: id })
        );
        expect(propia.body).toEqual({ disponible: true, motivo: "libre" });

        const falta = await auth(request(app).get('/contenido/paginas/slug-disponible'));
        expect(falta.status).toBe(400);
    });

    it('reemplaza la página completa: lo omitido vuelve al valor por defecto', async () => {
        const imagen = await imagenDe("portada", 1200, 600);
        const slug = slugUnico("reemplazo");
        const creada = await crearPagina({
            titulo: "Original",
            slug,
            descripcion: "Descripción",
            visibleEnMenu: true,
            orden: 3,
            portada: { imagenId: imagen.id, textoAlternativo: "Alt" },
            bloques: [{ tipo: "texto", contenido: "Hola" }]
        });
        expectCreadoContenido(creada);

        const res = await actualizarPagina(creada.body.pagina.id, {});
        expect(res.status).toBe(200);
        expect(res.body.pagina).toMatchObject({
            titulo: "",
            slug: null,
            descripcion: null,
            visibleEnMenu: false,
            orden: 0,
            portada: null,
            bloques: [],
            estado: "borrador"
        });
    });

    it('rechaza textos por encima de los límites y valores de tipo incorrecto', async () => {
        expect((await crearPagina({ titulo: "a".repeat(201) })).status).toBe(400);
        expect((await crearPagina({ descripcion: "a".repeat(321) })).status).toBe(400);
        expect((await crearPagina({ orden: -1 })).status).toBe(400);
        expect((await crearPagina({ visibleEnMenu: "sí" })).status).toBe(400);
    });

    it('una página de otra cuenta devuelve 404 y sin sesión 401', async () => {
        const pagina = await crearPagina({ titulo: "Propia", slug: slugUnico("propia") });

        const otra = await auth(request(app).get(`/contenido/paginas/${pagina.body.pagina.id}`), otroToken);
        expectContenidoNotFound(otra);

        const sinSesion = await request(app).get(`/contenido/paginas/${pagina.body.pagina.id}`);
        expect(sinSesion.status).toBe(401);
        expect(sinSesion.body.error.codigo).toBe("no_autenticado");
    });
});

describe('bloques tipados', () => {
    it('guarda los siete tipos, conserva ids y devuelve el orden guardado', async () => {
        const portada = await imagenDe("portada", 1200, 600);
        const bloque = await imagenDe("bloque", 800, 450);
        const slug = slugUnico("bloques");

        const res = await crearPagina({
            titulo: "Bloques",
            slug,
            descripcion: "Todos los tipos",
            bloques: [
                { tipo: "hero", titulo: "Hero", bajada: "Bajada", imagen: { imagenId: portada.id, textoAlternativo: "Hero" } },
                { tipo: "texto", contenido: "Párrafo con **negrita** y [link](/destino)" },
                { tipo: "imagen_texto", texto: "Texto", imagen: { imagenId: bloque.id, textoAlternativo: "Bloque" }, posicion: "izquierda" },
                { tipo: "galeria", imagenes: [{ imagenId: bloque.id, textoAlternativo: "Gal" }], columnas: 2 },
                { tipo: "cita", texto: "Cita", autor: "Autora", fuente: "Libro" },
                { tipo: "datos", items: [{ valor: "1", etiqueta: "Uno" }] },
                { tipo: "enlaces", enlaces: [{ nombre: "Sitio", destino: "https://ejemplo.com" }] }
            ]
        });
        expectCreadoContenido(res);

        const guardados = res.body.pagina.bloques as { id: number; tipo: string }[];
        expect(guardados.map((b) => b.tipo)).toEqual([
            "hero", "texto", "imagen_texto", "galeria", "cita", "datos", "enlaces"
        ]);
        expect(guardados.every((b) => typeof b.id === "number")).toBe(true);
        expect(res.body.pagina.bloques[1].contenido).toBe("Párrafo con **negrita** y [link](/destino)");

        const reordenados = [...guardados].reverse().map((b) => ({ id: b.id, ...res.body.pagina.bloques.find((x: { id: number }) => x.id === b.id) }));
        const update = await actualizarPagina(res.body.pagina.id, {
            titulo: "Bloques",
            slug,
            descripcion: "Todos los tipos",
            bloques: reordenados
        });
        expect(update.status).toBe(200);
        expect((update.body.pagina.bloques as { id: number }[]).map((b) => b.id)).toEqual(
            reordenados.map((b) => b.id)
        );

        const soloDos = await actualizarPagina(res.body.pagina.id, {
            titulo: "Bloques",
            slug,
            descripcion: "Todos los tipos",
            bloques: [{ id: guardados[1].id, tipo: "texto", contenido: "Queda uno" }]
        });
        expect(soloDos.body.pagina.bloques as unknown[]).toHaveLength(1);
    });

    it('rechaza campos de otro tipo, tipos desconocidos y límites', async () => {
        const casos: Record<string, unknown>[] = [
            { tipo: "desconocido" },
            { tipo: "galeria", imagen: { imagenId: 1 } },
            { tipo: "texto", imagenes: [] },
            { tipo: "galeria", columnas: 4 },
            { tipo: "imagen_texto", texto: "x", posicion: "centro" }
        ];

        for (const bloque of casos) {
            const res = await crearPagina({ bloques: [bloque] });
            expect(res.status).toBe(400);
            expect(res.body.error.codigo).toBe("bloque_invalido");
        }

        const demasiados = await crearPagina({
            bloques: Array.from({ length: 61 }, () => ({ tipo: "texto", contenido: "x" }))
        });
        expect(demasiados.status).toBe(400);

        const galeria = await crearPagina({
            bloques: [{
                tipo: "galeria",
                imagenes: Array.from({ length: 25 }, () => ({ imagenId: 1, textoAlternativo: "x" }))
            }]
        });
        expect(galeria.status).toBe(400);

        const datos = await crearPagina({
            bloques: [{
                tipo: "datos",
                items: Array.from({ length: 5 }, (_, i) => ({ valor: String(i), etiqueta: String(i) }))
            }]
        });
        expect(datos.status).toBe(400);

        const enlaces = await crearPagina({
            bloques: [{
                tipo: "enlaces",
                enlaces: Array.from({ length: 21 }, () => ({ nombre: "x", destino: "/x" }))
            }]
        });
        expect(enlaces.status).toBe(400);
    });

    it('valida referencias de imagen y resolución según el destino', async () => {
        const inexistente = await crearPagina({
            bloques: [{ tipo: "galeria", imagenes: [{ imagenId: 999999, textoAlternativo: "x" }] }]
        });
        expect(inexistente.status).toBe(400);
        expect(inexistente.body.error.codigo).toBe("imagen_inexistente");

        const chica = await imagenDe("bloque", 800, 450);
        const heroChico = await crearPagina({
            bloques: [{ tipo: "hero", imagen: { imagenId: chica.id, textoAlternativo: "Hero" } }]
        });
        expect(heroChico.status).toBe(400);
        expect(heroChico.body.error.codigo).toBe("imagen_resolucion_insuficiente");

        const grande = await imagenDe("bloque", 1200, 600);
        const enGaleria = await crearPagina({
            bloques: [{ tipo: "galeria", imagenes: [{ imagenId: grande.id, textoAlternativo: "Gal" }] }]
        });
        expectCreadoContenido(enGaleria);
    });

    it('rechaza HTML y destinos peligrosos, y normaliza alt vacío', async () => {
        const html = await crearPagina({ bloques: [{ tipo: "texto", contenido: "<strong>no</strong>" }] });
        expect(html.status).toBe(400);
        expect(html.body.error.codigo).toBe("texto_invalido");

        const script = await crearPagina({ bloques: [{ tipo: "texto", contenido: "<script>alert(1)</script>" }] });
        expect(script.status).toBe(400);

        const javascript = await crearPagina({
            bloques: [{ tipo: "enlaces", enlaces: [{ nombre: "x", destino: "javascript:alert(1)" }] }]
        });
        expect(javascript.status).toBe(400);

        const data = await crearPagina({
            bloques: [{ tipo: "enlaces", enlaces: [{ nombre: "x", destino: "data:text/html,x" }] }]
        });
        expect(data.status).toBe(400);

        const valido = await crearPagina({
            bloques: [{ tipo: "enlaces", enlaces: [{ nombre: "x", destino: "/pagina" }] }]
        });
        expectCreadoContenido(valido);

        const altLargo = await imagenDe("bloque", 800, 450);
        const excedido = await crearPagina({
            bloques: [{
                tipo: "galeria",
                imagenes: [{ imagenId: altLargo.id, textoAlternativo: "a".repeat(301) }]
            }]
        });
        expect(excedido.status).toBe(400);

        const espacios = await crearPagina({
            bloques: [{
                tipo: "galeria",
                imagenes: [{ imagenId: altLargo.id, textoAlternativo: "   " }]
            }]
        });
        expectCreadoContenido(espacios);
        expect(espacios.body.pagina.bloques[0].imagenes[0].textoAlternativo).toBe("");
    });
});

describe('publicación', () => {
    it('devuelve todos los faltantes juntos con publicacion_incompleta', async () => {
        const imagen = await imagenDe("portada", 1200, 600);
        const pagina = await crearPagina({
            portada: { imagenId: imagen.id, textoAlternativo: " " },
            bloques: [{
                tipo: "hero",
                imagen: { imagenId: imagen.id, textoAlternativo: "" }
            }]
        });
        expectCreadoContenido(pagina);

        const res = await publicarPagina(pagina.body.pagina.id);
        expect(res.status).toBe(422);
        expect(res.body.error.codigo).toBe("publicacion_incompleta");
        const codigos = (res.body.error.detalles as { codigo: string }[]).map((d) => d.codigo);
        expect(codigos).toEqual(expect.arrayContaining([
            "titulo_faltante",
            "descripcion_faltante",
            "slug_faltante",
            "imagen_sin_texto_alternativo"
        ]));
    });

    it('publica, conserva la edición previa y despublica sin borrar bloques', async () => {
        const imagen = await imagenDe("portada", 1200, 600);
        const slug = slugUnico("publicada");
        const creada = await crearPagina({
            titulo: "Publicable",
            slug,
            descripcion: "Descripción",
            portada: { imagenId: imagen.id, textoAlternativo: "Portada" },
            bloques: [{ tipo: "texto", contenido: "Contenido" }]
        });
        expectCreadoContenido(creada);

        const publicada = await publicarPagina(creada.body.pagina.id);
        expect(publicada.status).toBe(200);
        expect(publicada.body.pagina.estado).toBe("publicada");
        const editadaEn = publicada.body.pagina.actualizadaEn;

        const repetida = await publicarPagina(creada.body.pagina.id);
        expect(repetida.status).toBe(200);
        expect(repetida.body.pagina.actualizadaEn).toBe(editadaEn);

        const guardada = await actualizarPagina(creada.body.pagina.id, {
            titulo: "Publicable editada",
            slug,
            descripcion: "Descripción",
            bloques: [{ tipo: "texto", contenido: "Cambió" }]
        });
        expect(guardada.status).toBe(200);
        expect(guardada.body.pagina.estado).toBe("publicada");

        const despublicada = await despublicarPagina(creada.body.pagina.id);
        expect(despublicada.status).toBe(200);
        expect(despublicada.body.pagina.estado).toBe("borrador");
        expect(despublicada.body.pagina.bloques).toHaveLength(1);

        const otraVez = await despublicarPagina(creada.body.pagina.id);
        expect(otraVez.status).toBe(200);
    });

    it('un borrador incompleto se guarda y sigue en borrador', async () => {
        const creada = await crearPagina({ titulo: "Incompleta" });
        const res = await actualizarPagina(creada.body.pagina.id, { titulo: "Incompleta todavía" });

        expect(res.status).toBe(200);
        expect(res.body.pagina.estado).toBe("borrador");
    });

    it('otra cuenta o una página dada de baja devuelve 404', async () => {
        const creada = await crearPagina({ titulo: "No publicable" });

        const deOtraCuenta = await publicarPagina(creada.body.pagina.id, otroToken);
        expect(deOtraCuenta.status).toBe(404);

        await borrarPagina(creada.body.pagina.id);
        const dadaDeBaja = await publicarPagina(creada.body.pagina.id);
        expect(dadaDeBaja.status).toBe(404);
    });
});

describe('baja lógica', () => {
    it('oculta la página, libera el slug y permite borrar sus imágenes', async () => {
        const imagen = await imagenDe("portada", 1200, 600);
        const slug = slugUnico("baja");
        const creada = await crearPagina({
            titulo: "Para dar de baja",
            slug,
            descripcion: "Descripción",
            portada: { imagenId: imagen.id, textoAlternativo: "Portada" },
            bloques: [{ tipo: "texto", contenido: "Sigue guardado" }]
        });
        await publicarPagina(creada.body.pagina.id);

        const borrada = await borrarPagina(creada.body.pagina.id);
        expect(borrada.status).toBe(200);
        expect(borrada.body).toEqual({ eliminada: true });

        expectContenidoNotFound(await auth(request(app).get(`/contenido/paginas/${creada.body.pagina.id}`)));
        await expectPublicNotFound(publica(`/paginas/${slug}`));

        const listado = await auth(request(app).get('/contenido/paginas').query({ buscar: slug }));
        expect(listado.body.total).toBe(0);

        const reutilizado = await crearPagina({ titulo: "Mismo slug", slug });
        expectCreadoContenido(reutilizado);

        const imagenLiberada = await auth(request(app).delete(`/contenido/imagenes/${imagen.id}`));
        expect(imagenLiberada.status).toBe(200);
    });

    it('una página de otra cuenta o ya dada de baja devuelve 404', async () => {
        const creada = await crearPagina({ titulo: "Baja ajena" });

        const deOtraCuenta = await borrarPagina(creada.body.pagina.id, otroToken);
        expect(deOtraCuenta.status).toBe(404);

        await borrarPagina(creada.body.pagina.id);
        const yaDadaDeBaja = await borrarPagina(creada.body.pagina.id);
        expect(yaDadaDeBaja.status).toBe(404);
    });
});

describe('API pública de contenido', () => {
    it('lista sólo publicadas, con portada resuelta y sin datos internos', async () => {
        const publicada = await imagenDe("portada", 1200, 600);
        const slug = slugUnico("publico");
        const pagina = await crearPagina({
            titulo: "Página pública",
            slug,
            descripcion: "Para la landing",
            portada: { imagenId: publicada.id, textoAlternativo: "Portada pública" },
            bloques: [{ tipo: "texto", contenido: "Contenido público" }]
        });
        await publicarPagina(pagina.body.pagina.id);

        const borrador = await crearPagina({ titulo: "Borrador oculto", slug: slugUnico("borrador") });

        const res = await publica('/paginas');
        expect(res.status).toBe(200);
        const propia = res.body.paginas.find((p: { slug: string }) => p.slug === slug);
        expect(propia).toMatchObject({
            slug,
            titulo: "Página pública",
            descripcion: "Para la landing",
            portada: { textoAlternativo: "Portada pública", ancho: 1200, alto: 600 }
        });
        expect(propia.id).toBeUndefined();
        expect(propia.portada.imagenId).toBeUndefined();
        expect(res.body.paginas.some((p: { slug: string }) => p.slug === borrador.body.pagina.slug)).toBe(false);
        expect(JSON.stringify(res.body)).not.toContain("actualizadaPor");
    });

    it('devuelve el detalle por slug con los bloques en orden', async () => {
        const slug = slugUnico("detalle");
        const pagina = await crearPagina({
            titulo: "Detalle",
            slug,
            descripcion: "Descripción",
            bloques: [
                { tipo: "texto", contenido: "Primero" },
                { tipo: "cita", texto: "Segundo", autor: "Autora" }
            ]
        });
        await publicarPagina(pagina.body.pagina.id);

        const res = await publica(`/paginas/${slug}`);
        expect(res.status).toBe(200);
        expect(res.body.pagina.slug).toBe(slug);
        expect(res.body.pagina.id).toBeUndefined();
        expect(res.body.pagina.bloques.map((b: { tipo: string }) => b.tipo)).toEqual(["texto", "cita"]);
        expect(res.body.pagina.bloques[0].id).toBeTypeOf("number");
        expect(JSON.stringify(res.body)).not.toContain("imagenId");
    });

    it('un borrador, una baja o un slug inexistente devuelve 404', async () => {
        const borrador = await crearPagina({ titulo: "Oculto", slug: slugUnico("oculto") });
        await expectPublicNotFound(publica(`/paginas/${borrador.body.pagina.slug}`));

        const publicada = await crearPagina({
            titulo: "Se da de baja",
            slug: slugUnico("se-baja"),
            descripcion: "Descripción",
            bloques: [{ tipo: "texto", contenido: "x" }]
        });
        await publicarPagina(publicada.body.pagina.id);
        await borrarPagina(publicada.body.pagina.id);
        await expectPublicNotFound(publica(`/paginas/${publicada.body.pagina.slug}`));

        await expectPublicNotFound(publica('/paginas/no-existe'));
    });

    it('el menú respeta publicación, visibilidad y orden', async () => {
        const visibleA = await crearPagina({
            titulo: "Menú B",
            slug: slugUnico("menu-b"),
            descripcion: "x",
            visibleEnMenu: true,
            orden: 10,
            bloques: [{ tipo: "texto", contenido: "x" }]
        });
        const visibleB = await crearPagina({
            titulo: "Menú A",
            slug: slugUnico("menu-a"),
            descripcion: "x",
            visibleEnMenu: true,
            orden: 1,
            bloques: [{ tipo: "texto", contenido: "x" }]
        });
        const noVisible = await crearPagina({
            titulo: "Menú oculto",
            slug: slugUnico("menu-oculto"),
            descripcion: "x",
            visibleEnMenu: false,
            bloques: [{ tipo: "texto", contenido: "x" }]
        });

        await publicarPagina(visibleA.body.pagina.id);
        await publicarPagina(visibleB.body.pagina.id);
        await publicarPagina(noVisible.body.pagina.id);

        const res = await publica('/menu');
        expect(res.status).toBe(200);
        const slugs = res.body.paginas.map((p: { slug: string }) => p.slug);
        expect(slugs).toContain(visibleA.body.pagina.slug);
        expect(slugs).toContain(visibleB.body.pagina.slug);
        expect(slugs).not.toContain(noVisible.body.pagina.slug);
        expect(slugs.indexOf(visibleB.body.pagina.slug)).toBeLessThan(
            slugs.indexOf(visibleA.body.pagina.slug)
        );

        await despublicarPagina(visibleB.body.pagina.id);
        const despues = await publica('/menu');
        expect(despues.body.paginas.some((p: { slug: string }) => p.slug === visibleB.body.pagina.slug)).toBe(false);
    });

    it('autentica con API key y controla el origen', async () => {
        const sinClave = await request(app).get('/public/tienda/v1/contenido/paginas');
        expect(sinClave.status).toBe(401);
        expect(sinClave.body.error.codigo).toBe("no_autenticado");

        const claveInvalida = await publica('/paginas', "epb_inexistente");
        expect(claveInvalida.status).toBe(401);

        const otroOrigen = await publica('/paginas', apiKey, 'https://otro.test');
        expect(otroOrigen.status).toBe(403);
        expect(otroOrigen.body.error.codigo).toBe("origen_no_permitido");

        const sinOrigin = await publica('/paginas', apiKey, null);
        expect(sinOrigin.status).toBe(200);
    });

    it('cada integración ve sólo las páginas de su cuenta', async () => {
        const slug = slugUnico("mismo-slug");
        const deLaOtra = await crearPagina({
            titulo: "De la otra cuenta",
            slug,
            descripcion: "x",
            bloques: [{ tipo: "texto", contenido: "x" }]
        }, otroToken);
        await publicarPagina(deLaOtra.body.pagina.id, otroToken);

        const propiaLista = await publica('/paginas', apiKey);
        const otraLista = await publica('/paginas', otroApiKey);
        expect(propiaLista.body.paginas.some((p: { slug: string }) => p.slug === slug)).toBe(false);
        expect(otraLista.body.paginas.some((p: { slug: string }) => p.slug === slug)).toBe(true);

        await expectPublicNotFound(publica(`/paginas/${slug}`, apiKey));
        expect((await publica(`/paginas/${slug}`, otroApiKey)).status).toBe(200);

        const mismaSlugPropia = await crearPagina({
            titulo: "Mismo slug propio",
            slug,
            descripcion: "x",
            bloques: [{ tipo: "texto", contenido: "x" }]
        });
        expectCreadoContenido(mismaSlugPropia);
    });

    it('las URLs de imagen responden sin API key', async () => {
        const imagen = await imagenDe("portada", 1200, 600);
        const pagina = await crearPagina({
            titulo: "Con imagen",
            slug: slugUnico("con-imagen"),
            descripcion: "x",
            portada: { imagenId: imagen.id, textoAlternativo: "Alt" },
            bloques: [{ tipo: "texto", contenido: "x" }]
        });
        await publicarPagina(pagina.body.pagina.id);

        const detalle = await publica(`/paginas/${pagina.body.pagina.slug}`);
        const url = detalle.body.pagina.portada.url as string;
        const archivo = await request(app).get(pathnameOf(url));
        expect(archivo.status).toBe(200);
    });
});
