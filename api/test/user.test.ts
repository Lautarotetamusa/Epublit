import {describe, expect, it} from '@jest/globals';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../../.env");
dotenv.config({path: path});

import {conn} from '../src/db'
import {expect_err_code, expect_success_code} from './util';

const app = 'http://localhost:3001';

const cuit = "20173080329"
let user: any;
user = {
    username: "martinpdisalvo",
    password: "ANASHEEEEEEE"
};

it('Hard delete', async () => {
    await conn.query(`
        delete from users where cuit=${cuit} or username = '${user.username}'`
    );
});

describe('POST user/register', () => {
    it('Sin cuit', async () => {
        const res = await request(app)
            .post('/user/register').send(user)
        user.cuit = "12345";
        
        expect_err_code(400, res);
    });

    it('User no está en AFIP', async () => {
        const res = await request(app)
            .post('/user/register').send(user)
        user.cuit = cuit;
        
        expect_err_code(404, res);
    });

    it('Creado con exito', async () => {
        const res = await request(app)
            .post('/user/register').send(user)
        
        expect_success_code(201, res);
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
        expect(res.body.error).toEqual("Contraseña incorrecta");
    });

    it('Login exitoso', async () => {
        user.password = "ANASHEEEEEEE";

        const res = await request(app)
            .post('/user/login').send(user)
        
        expect_success_code(200, res);
        expect(res.body.message).toEqual("login exitoso");
        expect(res.body).toHaveProperty("token");
    });
});
