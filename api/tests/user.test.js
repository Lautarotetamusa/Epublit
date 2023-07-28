import request from 'supertest';
import chai from 'chai';
import bcrypt from "bcrypt";

process.env.DB_HOST = "localhost",
process.env.DB_USER = "teti",
process.env.DB_PASS = "Lautaro123.",
process.env.DB_NAME = "librossilvestres"
import {conn} from '../src/db.js'

import {expect_err_code, expect_success_code} from './util.js';

let user = {
    username: "martinpdisalvo",
    password: "ANASHEEEEEEE"
};
const app = 'http://localhost:3001';

it('Hard delete', async () => {
    await conn.query(`
        delete from users where cuit=20434919798`
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
        user.cuit = "20434919798";
        
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
        
        expect_success_code(404, res);
    });
});

describe('POST /login', () => {
    it('Contraseña incorrecta', async () => {
        user.password = "mala contraseña";

        const res = await request(app)
            .post('/user/login').send(user)
        
        expect_err_code(401, res);
        chai.expect(res.body.error).to.equal("Contraseña incorrecta");
    });

    it('Login exitoso', async () => {
        user.password = "ANASHEEEEEEE";

        const res = await request(app)
            .post('/user/login').send(user)
        
        expect_success_code(200, res);
        chai.expect(res.body.message).to.equal("login exitoso");
        chai.expect(res.body).to.have.property("token");
    });
});