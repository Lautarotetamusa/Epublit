import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

dotenv.config({ path: join(__dirname, "../.env") });

import { app, server } from '../src/index';
import { db } from '../src/db/client';
import { expectCreated, expectNotFound, expectBadRequest, expectDataResponse, expectConflict, getRolId } from './util';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { isbn, dni } from '../seeders/data';

let token: string;
let otroToken: string;
let rolAutor: number;
let rolIlustrador: number;
let rolAutorAjeno: number;

// Este archivo prueba una secuencia larga de altas/bajas sobre las mismas
// asociaciones libro-persona: usa un libro y personas propios (no seedeados)
// para no interferir con las participaciones que el seed ya les asignó a los
// libros existentes, ni que ellos interfieran acá. El rol de cada
// participación es el de la cuenta (ver specs/011-roles).
const libro: any = {
    isbn: isbn(9997),
    titulo: "Test libro_persona",
    fecha_edicion: "2020-02-17",
    precio: 10000,
};
const personaAutor: any = { nombre: "Autor Test", dni: dni(9990) };
const personaIlustrador: any = { nombre: "Ilustrador Test", dni: dni(9991) };
const personaAjena: any = { nombre: "Ajena Test", dni: dni(9992) };

const auth = (req: request.Test, t = token) => req.set('Authorization', `Bearer ${t}`);

const personasDeLibro = async (isbnLibro = libro.isbn) => {
    const res = await auth(request(app).get(`/libro/${isbnLibro}`));
    return res.body.data.personas as { id_persona: number; rol: { id: number; nombre: string }; porcentaje: number }[];
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

    rolAutor = await getRolId(app, token, 'autor');
    rolIlustrador = await getRolId(app, token, 'ilustrador');
    rolAutorAjeno = await getRolId(app, otroToken, 'autor');
});

afterAll(() => {
    db.$client.end();
    server.close();
});

describe('Setup: libro y personas propios', () => {
    it('Crear libro', async () => {
        const res = await auth(request(app).post('/libro/').send(libro));

        expectCreated(res);
        libro.id_libro = res.body.data.id_libro;
    });

    it('Crear persona autor', async () => {
        const res = await auth(request(app).post('/persona/').send(personaAutor));

        expectCreated(res);
        personaAutor.id = res.body.data.id;
    });

    it('Crear persona ilustrador', async () => {
        const res = await auth(request(app).post('/persona/').send(personaIlustrador));

        expectCreated(res);
        personaIlustrador.id = res.body.data.id;
    });

    it('Crear persona ajena (no se asocia a ningún libro)', async () => {
        const res = await auth(request(app).post('/persona/').send(personaAjena));

        expectCreated(res);
        personaAjena.id = res.body.data.id;
    });
});

describe('POST /libro/:isbn/personas', () => {
    it('Isbn ajeno/inexistente: 404', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}999/personas`)
                .send({ id_persona: personaAutor.id, rol: rolAutor, porcentaje: 100 })
        );

        expectNotFound(res);
    });

    it('Persona inexistente: 404', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id + 100000, rol: rolAutor, porcentaje: 100 })
        );

        expectNotFound(res);
    });

    it('Rol inexistente o de otra cuenta: 404', async () => {
        expectNotFound(
            await auth(request(app).post(`/libro/${libro.isbn}/personas`).send({ id_persona: personaAutor.id, rol: 999999999, porcentaje: 10 }))
        );
        expectNotFound(
            await auth(request(app).post(`/libro/${libro.isbn}/personas`).send({ id_persona: personaAutor.id, rol: rolAutorAjeno, porcentaje: 10 }))
        );
    });

    it('Sin rol: 400', async () => {
        const res = await auth(request(app).post(`/libro/${libro.isbn}/personas`).send({ id_persona: personaAutor.id, porcentaje: 100 }));

        expectBadRequest(res);
    });

    it('Porcentaje fuera de rango: 400', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: rolAutor, porcentaje: 150 })
        );

        expectBadRequest(res);
    });

    it('Alta simple (objeto único)', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: rolAutor, porcentaje: 50 })
        );

        expectCreated(res);
        expect(res.body.data.personas).toHaveLength(1);

        // La relación queda ligada al rol de la cuenta (el detalle la resuelve
        // como { id, nombre }).
        const propias = await personasDeLibro();
        expect(propias.find((p) => p.id_persona === personaAutor.id && p.rol.id === rolAutor)?.rol.nombre).toBe('autor');
    });

    it('La misma persona puede tener roles distintos en el mismo libro', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: rolIlustrador, porcentaje: 10 })
        );

        expectCreated(res);

        const propias = await personasDeLibro();
        const deAutor = propias.filter((p) => p.id_persona === personaAutor.id);
        expect(deAutor).toHaveLength(2);
        expect(deAutor.map((p) => p.rol.nombre).sort()).toEqual(['autor', 'ilustrador']);
    });

    it('Duplicado: misma persona y mismo rol ya asociados: 409 (no duplica)', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: rolAutor, porcentaje: 10 })
        );

        expectConflict(res);

        const propias = await personasDeLibro();
        expect(propias.filter((p) => p.id_persona === personaAutor.id && p.rol.id === rolAutor)).toHaveLength(1);
    });

    it('Alta en lote (personaIlustrador con rol ilustrador)', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}/personas`)
                .send([{ id_persona: personaIlustrador.id, rol: rolIlustrador, porcentaje: 20 }])
        );

        expectCreated(res);
        expect(res.body.data.personas).toHaveLength(1);
    });
});

describe('PUT /libro/:isbn/personas', () => {
    it('Edición simple de porcentaje', async () => {
        const res = await auth(
            request(app)
                .put(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: rolAutor, porcentaje: 70 })
        );

        expectDataResponse(res, 201);
        expect(res.body.data.personas[0].porcentaje).toBe(70);
    });

    it('Edición con porcentaje 0 (corrección del bug MySQL)', async () => {
        const res = await auth(
            request(app)
                .put(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: rolAutor, porcentaje: 0 })
        );

        expectDataResponse(res, 201);

        const propias = await personasDeLibro();
        const autor = propias.find((p) => p.id_persona === personaAutor.id && p.rol.id === rolAutor);
        expect(autor?.porcentaje).toBe(0);
    });

    it('Combinación (id_persona, rol) no asociada: 404 y todo o nada', async () => {
        const res = await auth(
            request(app)
                .put(`/libro/${libro.isbn}/personas`)
                .send([
                    { id_persona: personaIlustrador.id, rol: rolIlustrador, porcentaje: 99 },
                    // personaIlustrador nunca se asoció con el rol autor.
                    { id_persona: personaIlustrador.id, rol: rolAutor, porcentaje: 99 }
                ])
        );

        expectNotFound(res);

        const propias = await personasDeLibro();
        const ilustrador = propias.find((p) => p.id_persona === personaIlustrador.id && p.rol.id === rolIlustrador);
        expect(ilustrador?.porcentaje).not.toBe(99);
    });

    it('Rol inexistente: 404', async () => {
        const res = await auth(
            request(app)
                .put(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: 999999999, porcentaje: 10 })
        );

        expectNotFound(res);
    });
});

describe('DELETE /libro/:isbn/personas', () => {
    it('Asociación inexistente: 404', async () => {
        const res = await auth(
            request(app)
                .delete(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAjena.id, rol: rolAutor })
        );

        expectNotFound(res);
    });

    it('Baja simple: quita la relación con ese rol', async () => {
        const res = await auth(
            request(app)
                .delete(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAutor.id, rol: rolAutor })
        );

        expect(res.status).toBe(200);

        const propias = await personasDeLibro();
        expect(propias.some((p) => p.id_persona === personaAutor.id && p.rol.id === rolAutor)).toBe(false);
        // El otro rol de la misma persona en el libro sigue asociado.
        expect(propias.some((p) => p.id_persona === personaAutor.id && p.rol.id === rolIlustrador)).toBe(true);
    });

    it('Baja en lote: deja el libro sin personas', async () => {
        const res = await auth(
            request(app)
                .delete(`/libro/${libro.isbn}/personas`)
                .send([
                    { id_persona: personaAutor.id, rol: rolIlustrador },
                    { id_persona: personaIlustrador.id, rol: rolIlustrador }
                ])
        );

        expect(res.status).toBe(200);
        expect(await personasDeLibro()).toEqual([]);
    });

    it('No borra la persona ni sus otros roles en otros libros', async () => {
        const res = await auth(request(app).get(`/persona/${personaAutor.id}`));

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(personaAutor.id);
    });
});

describe('Libro eliminado: personas responde 404', () => {
    it('Eliminar el libro', async () => {
        const res = await auth(request(app).delete(`/libro/${libro.isbn}`));
        expect(res.status).toBe(200);
    });

    it('POST /libro/:isbn/personas responde 404', async () => {
        const res = await auth(
            request(app)
                .post(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAjena.id, rol: rolAutor, porcentaje: 10 })
        );

        expectNotFound(res);
    });

    it('PUT /libro/:isbn/personas responde 404', async () => {
        const res = await auth(
            request(app)
                .put(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAjena.id, rol: rolAutor, porcentaje: 10 })
        );

        expectNotFound(res);
    });

    it('DELETE /libro/:isbn/personas responde 404', async () => {
        const res = await auth(
            request(app)
                .delete(`/libro/${libro.isbn}/personas`)
                .send({ id_persona: personaAjena.id, rol: rolAutor })
        );

        expectNotFound(res);
    });
});
