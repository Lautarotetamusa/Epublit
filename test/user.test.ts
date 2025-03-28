import {describe, expect, it} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";
import fs from "fs";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

jest.mock('../src/afip/Afip', () => {
    const actual = jest.requireActual('../src/afip/Afip');
    return {
        ...actual,
        getAfipData: jest.fn((cuit) => {
            if (cuit == "12345") throw new NotFound("El cuit no valido")

            return {
                ingresos_brutos: false,
                fecha_inicio: "10/02/2025",
                razon_social: "CLIENTE DE PRUEBA",
                cond_fiscal: "IVA EXENTO",
                domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
            }
        })
    }
});

process.env.DB_NAME = "epublit_test";
import {app, server} from '../src/app';
import {conn} from '../src/db'
import {expectErrorResponse, expectDataResponse, expectBadRequest, expectCreated, expectNotFound} from './util';
import { NotFound } from '../src/models/errors';

const cuit = "20173080329"
const userPath = join(__dirname, "../afipkeys/", cuit);
let user: any = {
    username: "testing",
    password: "ANASHEEEEEEE",
    email: "lauti@gmail.com"
};

let token: string;

beforeAll(() => {
    const userPath = join(__dirname, "../afipkeys/", cuit);
    fs.rmSync(userPath, {recursive: true, force: true});
});

afterAll(() => {
    conn.end();
    server.close();
});

it('Hard delete', async () => {
    await conn.query(`
        delete from users where cuit=${cuit} or username = '${user.username}'`
    );
});

describe('POST user/register', () => {
    it('Sin cuit', async () => {
        const res = await request(app)
            .post('/user/register').send(user)
        
        expectBadRequest(res);
    });

    it('User no está en AFIP', async () => {
        user.cuit = "12345";
        const res = await request(app)
            .post('/user/register').send(user)
        
        expectNotFound(res);
    });

    it('Creado con exito', async () => {
        user.cuit = cuit;
        const res = await request(app)
            .post('/user/register').send(user)
        
        expectCreated(res);

        expect(fs.existsSync(userPath)).toBe(true);
        expect(fs.existsSync(join(userPath, "Tokens"))).toBe(true);
    });

    test('existe CSR y private_key', async () => {
        expect(fs.existsSync(join(userPath, "private_key.key"))).toBe(true);
        expect(fs.existsSync(join(userPath, "cert.csr"))).toBe(true);
    });

    it('Crear usuario con el mismo cuit', async () => {
        const res = await request(app)
            .post('/user/register').send(user)
        
        expectBadRequest(res);
    });
});

describe('POST /login', () => {
    it('Contraseña incorrecta', async () => {
        user.password = "mala contraseña";

        const res = await request(app)
            .post('/user/login').send(user)
        
        expectErrorResponse(res, 401);
        expect(res.body.errors[0].message).toEqual("Contraseña incorrecta");
    });

    it('Login exitoso', async () => {
        user.password = "ANASHEEEEEEE";

        const res = await request(app)
            .post('/user/login').send(user)
        
        expect(res.status).toBe(200);
        expect(res.body.message).toEqual("login exitoso");
        expect(res.body).toHaveProperty("token");
        token = res.body.token;
    });

    it('se deben crear clientes mostrador y consumidor final', async () => {
        // Get the clients from the user
        const res = await request(app)
            .get('/cliente')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const clientes = res.body;

        expect(clientes).toHaveLength(2);
        
        // This order maybe its not always true, but its seems to works fine
        expect(clientes[0]).toMatchObject({
            tipo: "particular",
            nombre: "CONSUMIDOR FINAL",
            cond_fiscal: "CONSUMIDOR FINAL",
            razon_social: "CONSUMIDOR FINAL"
        });
        
        expect(clientes[1]).toMatchObject({
            tipo: "negro",
            nombre: "MOSTRADOR",
            cond_fiscal: "",
            razon_social: ""
        });
    })

    it('Traer datos del usuario', async () => {
        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);

        expectDataResponse(res, 200);
        const expected = {
            cuit: cuit,
            username: "testing",
            //email: "lauti@gmail.com",
            //ingresos_brutos: false,
            //fecha_inicio: "10/02/2025",
            razon_social: "CLIENTE DE PRUEBA",
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        }

        expect(res.body.data).toMatchObject(expected);
    });
});

describe('PUT /user', () => {
    let initialUserData: any;

    beforeAll(async () => {
        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);
        
        initialUserData = res.body.data;
    });

    it('Actualización exitosa de email y punto_venta', async () => {
        const updateData = {
            email: "nuevoemail@test.com",
            punto_venta: 5
        };

        await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send(updateData)
            .expect(200);

        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.body.data).toMatchObject({
            ...initialUserData,
            ...updateData
        });
    });

    it('Actualización exitosa de solo un campo', async () => {
        const updateData = {
            email: "nuevonuevoemail@test.com",
        };

        await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send(updateData)
            .expect(200);

        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.body.data).toMatchObject({
            ...initialUserData,
            ...updateData,
            punto_venta: 5, // updated before
        });
    });

    it('No debería actualizar otros campos', async () => {
        const originalUsername = initialUserData.username;
        
        await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({ username: "nuevo_usuario" })
            .expect(200);

        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.body.data.username).toBe(originalUsername);
    });

    it('Request vacío no modifica valores', async () => {
        const currentRes = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);
        
        const currentData = currentRes.body.data;

        await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({})
            .expect(200);

        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);
        
        expect(res.body.data).toEqual(currentData);
    });

    it('Validación de punto_venta negativo', async () => {
        const res = await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({ punto_venta: -1 });

        expect(res.status).toBe(400);
    });

    it('Validación de email vacío', async () => {
        const res = await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send({ email: "" });

        expect(res.status).toBe(400);
    });
});

describe('Certificado', () => {
    test("subir certificado sin auth debe dar error", async () => {
        const res = await request(app)
            .post('/user/uploadCert')
            .attach('cert', "./test/test_cert.pem");

        expect(res.status).toBe(403);
    });

    test("No se sube el archivo", async () => {
        const res = await request(app)
            .post('/user/uploadCert')
            .set('Authorization', `Bearer ${token}`)

        expect(res.status).toBe(400);
        expect(res.body.errors.length).toBe(1);
        expect(res.body.errors[0].message).toEqual("El campo 'cert' es necesario");
        expect(fs.existsSync(join(userPath, "cert.pem"))).toBe(false);
    });

    test("Certificado invalido no se debe guardar", async () => {
        const res = await request(app)
            .post('/user/uploadCert')
            .set('Authorization', `Bearer ${token}`)
            .attach('cert', "./test/invalid_cert.pem");

        expect(res.status).toBe(400);
        expect(res.body.errors.length).toBe(1);
        expect(res.body.errors[0].message).toEqual("El certificado no es valido");
        expect(fs.existsSync(join(userPath, "cert.pem"))).toBe(false);
    });

    test("Subir certificado pem", async () => {
        const res = await request(app)
            .post('/user/uploadCert')
            .set('Authorization', `Bearer ${token}`)
            .attach('cert', "./test/test_cert.pem");

        expect(res.status).toBe(201);
        expect(fs.existsSync(join(userPath, "cert.pem"))).toBe(true);
    });
});
