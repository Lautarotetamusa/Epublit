import {describe, expect, it} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join, resolve } from "path";
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
import {expect_err_code, expect_success_code} from './util';
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
        
        expect_err_code(400, res);
    });

    it('User no está en AFIP', async () => {
        user.cuit = "12345";
        const res = await request(app)
            .post('/user/register').send(user)
        
        expect_err_code(404, res);
    });

    it('Creado con exito', async () => {
        user.cuit = cuit;
        const res = await request(app)
            .post('/user/register').send(user)
        
        expect_success_code(201, res);

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
        
        expect_err_code(400, res);
    });
});

describe('POST /login', () => {
    it('Contraseña incorrecta', async () => {
        user.password = "mala contraseña";

        const res = await request(app)
            .post('/user/login').send(user)
        
        expect_err_code(401, res);
        expect(res.body.errors[0].message).toEqual("Contraseña incorrecta");
    });

    it('Login exitoso', async () => {
        user.password = "ANASHEEEEEEE";

        const res = await request(app)
            .post('/user/login').send(user)
        
        expect_success_code(200, res);
        expect(res.body.message).toEqual("login exitoso");
        expect(res.body).toHaveProperty("token");
        token = res.body.token;
    });

    it('Traer datos del usuario', async () => {
        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);

        expect_success_code(200, res);
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
