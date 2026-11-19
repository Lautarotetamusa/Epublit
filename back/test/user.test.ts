import {describe, expect, it} from 'vitest';
import request from "supertest";

import * as dotenv from 'dotenv';
import { join } from "path";
import fs from "fs";
import { eq } from "drizzle-orm";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

import {db} from '../src/db/client';
import { usersTable } from '../src/db/schema';
import { firmarCertificadoDePrueba } from '../src/lib/afip/certificadoDePrueba';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import type { EnvioTemplate, TransporteEmail } from '../src/lib/email';
import {expectErrorResponse, expectDataResponse, expectBadRequest, expectConflict, expectCreated} from './util';
import { NotFound } from 'bradb';

const CUIT_FUERA_DEL_PADRON = "20123456786";
const afipService = createMockAfipService({
    getAfipData: async (cuitConsultado) => {
        if (cuitConsultado === CUIT_FUERA_DEL_PADRON) throw new NotFound("El cuit no valido");

        return {
            ingresos_brutos: false,
            fecha_inicio: "10/02/2025",
            razon_social: "CLIENTE DE PRUEBA",
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        };
    }
});
// Transporte de mail propio del test: guarda lo que se habría mandado y se
// puede forzar a fallar para probar que el alta no depende del envío.
const enviados: EnvioTemplate[] = [];
let fallarEnvio = false;
const transporteEmail: TransporteEmail = async (envio) => {
    if (fallarEnvio) throw new Error("Postmark caído");
    enviados.push(envio);
};
const container = createContainer({ afipService, emailTransporte: transporteEmail });
const app = createApp(container);

// Este archivo prueba el flujo de alta de usuario en sí (AFIP + generación
// de clave/CSR en el filesystem + clientes por defecto): no hay forma de
// "usarlo seedeado", el alta es lo que se está probando. `cuit`/`email`
// no colisionan con los usuarios fijos del seed (`libreria_sur`/`editorial_norte`).
// El detalle del registro con confirmación de email está en
// user_acceso.test.ts; acá se confirma la cuenta para probar el perfil.
const cuit = "20173080329"
const userPath = join(__dirname, "../afipkeys/", cuit);
let user: any = {
    password: "ANASHEEEEEEE",
    email: "lauti@gmail.com"
};
const tokenDelLink = (url: string) => new URL(url).searchParams.get("token");

let token: string;

beforeAll(() => {
    fs.rmSync(userPath, {recursive: true, force: true});
});

afterAll(() => {
    db.$client.end();
});

describe('POST user/register', () => {
    it('Sin cuit', async () => {
        const res = await request(app)
            .post('/user/register').send(user)
        
        expectBadRequest(res);
    });

    it('User no está en AFIP', async () => {
        user.cuit = CUIT_FUERA_DEL_PADRON;
        const res = await request(app)
            .post('/user/register').send(user)
        
        expectErrorResponse(res, 422);
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

    test('al confirmar el email manda la bienvenida con el CSR adjunto y el link a la guía', async () => {
        expect(enviados.map((envio) => envio.alias)).toEqual(["confirmar-email"]);

        const confirmacion = await request(app)
            .post('/user/verify-email')
            .send({ token: tokenDelLink(enviados[0].modelo.url_confirmar) });
        expect(confirmacion.body.status).toBe("verified");

        const bienvenida = enviados[1];
        expect(bienvenida).toMatchObject({
            alias: "bienvenida",
            para: user.email,
            modelo: {
                nombre: "CLIENTE DE PRUEBA",
                cuit,
                url_guia_certificado: expect.stringMatching(/\/ayuda\/certificado-arca$/),
                url_perfil: expect.stringMatching(/\/perfil$/)
            }
        });
        expect(bienvenida.adjuntos).toEqual([
            { nombre: `${cuit}.csr`, contenido: fs.readFileSync(join(userPath, "cert.csr")), tipo: "application/pkcs10" }
        ]);
    });

    it('Crear usuario con el mismo cuit', async () => {
        const res = await request(app)
            .post('/user/register').send({ ...user, email: "otro-lauti@gmail.com" })
        
        expectConflict(res);
        expect(res.body.errors[0]).toMatchObject({ code: "cuit_taken", field: "cuit" });
    });
});

describe('POST user/register con el mail caído', () => {
    const cuitSinMail = "20279723369";

    afterAll(() => {
        fallarEnvio = false;
        fs.rmSync(join(__dirname, "../afipkeys/", cuitSinMail), { recursive: true, force: true });
    });

    test('si el envío del mail de confirmación falla, el alta se completa igual', async () => {
        fallarEnvio = true;

        const res = await request(app)
            .post('/user/register')
            .send({ password: "ANASHEEEEEEE", email: "sin-mail@test.com", cuit: cuitSinMail });

        expectCreated(res);
    });
});

describe('POST /login', () => {
    it('Contraseña incorrecta', async () => {
        user.password = "mala contraseña";

        const res = await request(app)
            .post('/user/login').send({ identifier: user.email, password: user.password })
        
        expectErrorResponse(res, 401);
        expect(res.body.errors[0].code).toEqual("invalid_credentials");
    });

    it('Login exitoso', async () => {
        user.password = "ANASHEEEEEEE";

        const res = await request(app)
            .post('/user/login').send({ identifier: user.email, password: user.password })
        
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
        const clientes = res.body.items;

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
            email: user.email,
            username_interno: true,
            email_confirmado: true,
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

    it('permite corregir los datos fiscales del emisor (condición frente al IVA incluida)', async () => {
        const fiscales = {
            cond_fiscal: "Monotributo",
            razon_social: "Editorial Fiscal SRL",
            domicilio: "Calle Fiscal 123",
            ingresos_brutos: true,
            fecha_inicio: "01/03/2020"
        };

        await request(app)
            .put('/user')
            .set('Authorization', `Bearer ${token}`)
            .send(fiscales)
            .expect(200);

        const res = await request(app)
            .get('/user')
            .set('Authorization', `Bearer ${token}`);

        expect(res.body.data).toMatchObject(fiscales);
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

describe('PUT /user/afip', () => {
    it('refresca los datos de AFIP del usuario', async () => {
        const res = await request(app)
            .put('/user/afip')
            .set('Authorization', `Bearer ${token}`);

        expectDataResponse(res, 200);
        expect(res.body.data).toMatchObject({
            cuit,
            razon_social: "CLIENTE DE PRUEBA",
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        });
    });
});

const subirCertificado = (archivo: string) =>
    request(app)
        .post('/user/uploadCert')
        .set('Authorization', `Bearer ${token}`)
        .attach('cert', archivo);

const getFacturacion = () =>
    request(app)
        .get('/user/facturacion')
        .set('Authorization', `Bearer ${token}`);

const codigosPendientes = (res: request.Response) =>
    res.body.data.pendientes.map((p: { codigo: string }) => p.codigo);

describe('GET /user/facturacion antes del certificado', () => {
    test("sin auth da 403", async () => {
        expect((await request(app).get('/user/facturacion')).status).toBe(403);
    });

    test("una cuenta recién creada no está habilitada y le falta el certificado", async () => {
        const res = await getFacturacion();

        expectDataResponse(res, 200);
        expect(res.body.data).toMatchObject({
            habilitado: false,
            entorno: "homologacion",
            punto_venta: 5,
            certificado: { estado: "faltante", vence: null }
        });
        expect(codigosPendientes(res)).toEqual(["certificado"]);
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
        expect(fs.existsSync(join(userPath, "cert.crt"))).toBe(false);
    });

    test("Certificado invalido no se debe guardar", async () => {
        const res = await subirCertificado("./test/invalid_cert.pem");

        expect(res.status).toBe(400);
        expect(res.body.errors[0].message).toEqual("El archivo no es un certificado válido");
        expect(fs.existsSync(join(userPath, "cert.crt"))).toBe(false);
    });

    test("un certificado de otra cuenta no se guarda", async () => {
        const res = await subirCertificado("./test/test_cert.pem");

        expect(res.status).toBe(400);
        expect(res.body.errors[0].message).toEqual(
            "El certificado no corresponde a tu cuenta: generalo en ARCA con el CSR que descargás desde tu perfil"
        );
        expect(fs.existsSync(join(userPath, "cert.crt"))).toBe(false);
    });

    test("un certificado de la cuenta se guarda y la pasa a producción", async () => {
        const res = await subirCertificado(await firmarCertificadoDePrueba(cuit, 730));

        expect(res.status).toBe(201);
        expect(fs.existsSync(join(userPath, "cert.crt"))).toBe(true);

        const me = await request(app).get('/user').set('Authorization', `Bearer ${token}`);
        expect(me.body.data.production).toBe(true);
    });
});

describe('GET /user/facturacion con el certificado', () => {
    test("con certificado vigente, punto de venta y datos fiscales está habilitada", async () => {
        const res = await getFacturacion();

        expectDataResponse(res, 200);
        expect(res.body.data).toMatchObject({
            habilitado: true,
            entorno: "produccion",
            certificado: { estado: "vigente", vence: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }
        });
        expect(res.body.data.pendientes).toEqual([]);
    });

    test("un certificado que vence en menos de 30 días avisa pero sigue habilitada", async () => {
        expect((await subirCertificado(await firmarCertificadoDePrueba(cuit, 10))).status).toBe(201);

        const res = await getFacturacion();
        expect(res.body.data).toMatchObject({ habilitado: true, certificado: { estado: "por_vencer" } });
    });

    test("sin punto de venta deja de estar habilitada", async () => {
        await db.update(usersTable).set({ punto_venta: null }).where(eq(usersTable.cuit, cuit));

        const res = await getFacturacion();
        expect(res.body.data.habilitado).toBe(false);
        expect(codigosPendientes(res)).toEqual(["punto_venta"]);

        await db.update(usersTable).set({ punto_venta: 5 }).where(eq(usersTable.cuit, cuit));
    });
});

describe('GET /user/csr', () => {
    test("sin auth da 403", async () => {
        const res = await request(app).get('/user/csr');

        expect(res.status).toBe(403);
    });

    test("descarga el CSR generado en el alta", async () => {
        const res = await request(app)
            .get('/user/csr')
            .set('Authorization', `Bearer ${token}`)
            .buffer(true)
            .parse((response, callback) => {
                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('end', () => callback(null, Buffer.concat(chunks)));
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/pkcs10');
        expect(res.headers['content-disposition']).toBe(`attachment; filename="${cuit}.csr"`);
        expect(res.body).toEqual(fs.readFileSync(join(userPath, "cert.csr")));
    });

    test("si falta el CSR lo regenera con la clave existente", async () => {
        const claveAntes = fs.readFileSync(join(userPath, "private_key.key"));
        fs.rmSync(join(userPath, "cert.csr"));

        const res = await request(app)
            .get('/user/csr')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(fs.existsSync(join(userPath, "cert.csr"))).toBe(true);
        expect(fs.readFileSync(join(userPath, "private_key.key"))).toEqual(claveAntes);
    });
});

describe('Cuenta sin clave privada', () => {
    beforeAll(() => {
        fs.rmSync(join(userPath, "private_key.key"));
        fs.rmSync(join(userPath, "cert.csr"));
    });

    test("el estado de facturación marca el certificado como que no corresponde", async () => {
        const res = await getFacturacion();

        expectDataResponse(res, 200);
        expect(res.body.data.certificado.estado).toBe("no_corresponde");
        expect(res.body.data.habilitado).toBe(false);
    });

    test("subir un certificado da 400 y pide generarlo con el CSR del perfil", async () => {
        const res = await subirCertificado("./test/test_cert.pem");

        expect(res.status).toBe(400);
        expect(res.body.errors[0].message).toEqual(
            "El certificado no corresponde a tu cuenta: generalo en ARCA con el CSR que descargás desde tu perfil"
        );
    });

    test("descargar el CSR genera la clave y el CSR de la cuenta", async () => {
        const res = await request(app)
            .get('/user/csr')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(fs.existsSync(join(userPath, "private_key.key"))).toBe(true);
        expect(fs.existsSync(join(userPath, "cert.csr"))).toBe(true);
    });
});
