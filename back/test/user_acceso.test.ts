import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import request from "supertest";
import fs from "fs";
import { join } from "path";
import { createHash } from "crypto";
import forge from "node-forge";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { NotFound } from 'bradb';

import { db } from '../src/db/client';
import {
    usersTable,
    clientesTable,
    depositosTable,
    mediosPagoTable,
    rolesTable,
    coleccionesTable,
    tokensCuentaTable
} from '../src/db/schema';
import { env } from '../src/env';
import { isValidCuit } from '../src/lib/cuit';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import type { EnvioTemplate, TransporteEmail } from '../src/lib/email';
import { generarUsernameInterno } from '../src/modules/user/user.username';
import { startLimpiezaCuentasPendientes } from '../src/modules/user';
import { PASSWORD_SEED } from '../seeders/users.seeder';
import { expectErrorResponse } from './util';

// Registro con email confirmado, login por email o usuario y restablecer la
// contraseña (specs/026-registro-email). El reloj es del test: los plazos de
// 24 h / 1 h / 60 s se prueban adelantándolo, no esperando.
const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

let ahora = new Date();
const adelantar = (ms: number) => {
    ahora = new Date(ahora.getTime() + ms);
};

const usernamesForzados: string[] = [];

const cuitsFueraDelPadron = new Set<string>();
let padronCaido = false;
const consultasAlPadron: string[] = [];
const afipService = createMockAfipService({
    getAfipData: async (cuit) => {
        consultasAlPadron.push(cuit);
        if (padronCaido) throw new Error("timeout de ARCA");
        if (cuitsFueraDelPadron.has(cuit)) throw new NotFound("no está en el padrón");

        return {
            ingresos_brutos: false,
            fecha_inicio: "10/02/2025",
            razon_social: `EDITORIAL ${cuit}`,
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        };
    }
});

let enviados: EnvioTemplate[] = [];
let fallarEnvio = false;
const transporteEmail: TransporteEmail = async (envio) => {
    if (fallarEnvio) throw new Error("Postmark caído");
    enviados.push(envio);
};

const container = createContainer({
    afipService,
    emailTransporte: transporteEmail,
    user: {
        ahora: () => ahora,
        generarUsernameInterno: () => usernamesForzados.shift() ?? generarUsernameInterno()
    }
});
const app = createApp(container);

// CUITs con dígito verificador válido y fuera del rango del seed y de otros tests.
let ultimoCuit = 0;
const cuitsUsados: string[] = [];
const cuitNuevo = (): string => {
    ultimoCuit += 1;
    const base = `2055${String(ultimoCuit).padStart(6, "0")}`;
    const cuit = [..."0123456789"].map((digito) => base + digito).find(isValidCuit)!;
    cuitsUsados.push(cuit);
    return cuit;
};

let ultimoEmail = 0;
const emailNuevo = (): string => {
    ultimoEmail += 1;
    return `cuenta${ultimoEmail}@acceso.test`;
};

const PASSWORD = "clave1234";
const datosNuevos = () => ({ email: emailNuevo(), password: PASSWORD, cuit: cuitNuevo() });

const post = (ruta: string, body: object) => request(app).post(ruta).send(body);
const registrar = (datos: object) => post('/user/register', datos);
const confirmar = (token: string | null | undefined) => post('/user/verify-email', { token });
const reenviar = (email: string) => post('/user/resend-verification', { email });
const pedirRestablecer = (email: string) => post('/user/forgot-password', { email });
const consultarRestablecer = (token: string) => request(app).get(`/user/reset-password/${encodeURIComponent(token)}`);
const restablecer = (token: string, password: string) => post('/user/reset-password', { token, password });
const login = (identifier: string, password: string) => post('/user/login', { identifier, password });
const limpiar = () => container.user.accesoService.limpiarPendientesVencidas();

const mailsA = (para: string, alias?: string) =>
    enviados.filter((envio) => envio.para === para && (alias === undefined || envio.alias === alias));
const tokenDelLink = (url: string): string => new URL(url).searchParams.get("token")!;
const ultimoTokenDeConfirmacion = (email: string) => tokenDelLink(mailsA(email, "confirmar-email").at(-1)!.modelo.url_confirmar);
const ultimoTokenDeRestablecer = (email: string) =>
    tokenDelLink(mailsA(email, "restablecer-contrasena").at(-1)!.modelo.url_restablecer);

const cuentaPorEmail = async (email: string) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    return user;
};

const filasDeLaCuenta = async (userId: number) => {
    const contar = async (tabla: typeof clientesTable | typeof depositosTable | typeof mediosPagoTable | typeof rolesTable | typeof tokensCuentaTable) =>
        (await db.select({ total: sql<number>`count(*)::int` }).from(tabla).where(eq(tabla.user, userId)))[0].total;

    return {
        users: (await db.select().from(usersTable).where(eq(usersTable.id, userId))).length,
        clientes: await contar(clientesTable),
        depositos: await contar(depositosTable),
        medios_pago: await contar(mediosPagoTable),
        roles: await contar(rolesTable),
        tokens: await contar(tokensCuentaTable)
    };
};
const SIN_FILAS = { users: 0, clientes: 0, depositos: 0, medios_pago: 0, roles: 0, tokens: 0 };

const carpetaDeClaves = (cuit: string) => join(__dirname, "../afipkeys", cuit);

// Cuenta nueva sin confirmar, con su link de confirmación ya enviado.
const registrarPendiente = async (datos = datosNuevos()) => {
    const res = await registrar(datos);
    expect(res.status).toBe(201);
    return { ...datos, token: ultimoTokenDeConfirmacion(datos.email), user: await cuentaPorEmail(datos.email) };
};

const registrarConfirmada = async (datos = datosNuevos()) => {
    const pendiente = await registrarPendiente(datos);
    expect((await confirmar(pendiente.token)).body.status).toBe("verified");
    return pendiente;
};

// Cuenta anterior al registro por email (usuario elegido por la persona),
// creada sin pasar por `register`. Propia del test para poder cambiarle la
// contraseña sin romper el login de los otros archivos con el seed.
let ultimaVieja = 0;
const crearCuentaVieja = async (email: string | null = emailNuevo()) => {
    ultimaVieja += 1;
    const username = `vieja_acceso_${ultimaVieja}`;
    const user = await container.user.service.createUser({
        username,
        email,
        password: await bcrypt.hash(PASSWORD, 10),
        cuit: cuitNuevo(),
        cond_fiscal: "IVA EXENTO",
        razon_social: `Librería Vieja ${ultimaVieja} S.A.`,
        domicilio: "Calle 1",
        fecha_inicio: "01/01/2020",
        email_confirmado: true
    });
    return { ...user, password: PASSWORD };
};

const SEED = { username: "libreria_sur", email: "libreria_sur1@epublit.test" };

const expectErrorDeAcceso = (res: request.Response, status: number, error: Record<string, unknown>) => {
    expectErrorResponse(res, status);
    expect(res.body.errors[0]).toMatchObject(error);
};

beforeEach(() => {
    fallarEnvio = false;
    padronCaido = false;
});

afterAll(async () => {
    await db.delete(coleccionesTable).where(eq(coleccionesTable.titulo, "Bloquea el borrado"));
    for (const cuit of cuitsUsados) fs.rmSync(carpetaDeClaves(cuit), { recursive: true, force: true });
    await db.$client.end();
});

describe('Tarea 3: validación del registro', () => {
    test('el email se normaliza al guardarlo y al devolverlo', async () => {
        const res = await registrar({ email: " Ana@Editorial-Acceso.com ", password: PASSWORD, cuit: cuitNuevo() });

        expect(res.status).toBe(201);
        expect(res.body.data).toEqual({ email: "ana@editorial-acceso.com" });
        expect(await cuentaPorEmail("ana@editorial-acceso.com")).toBeDefined();
    });

    test('un email sin dominio es inválido', async () => {
        expectErrorDeAcceso(await registrar({ ...datosNuevos(), email: "ana@" }), 400, { code: "invalid_email", field: "email" });
    });

    test('la contraseña necesita al menos 8 caracteres', async () => {
        expectErrorDeAcceso(await registrar({ ...datosNuevos(), password: "1234567" }), 400, { code: "password_too_short", field: "password" });
        expect((await registrar({ ...datosNuevos(), password: "12345678" })).status).toBe(201);
    });

    test('el CUIT se valida con el dígito verificador y acepta guiones o puntos', async () => {
        expectErrorDeAcceso(await registrar({ ...datosNuevos(), cuit: "20-12345678-9" }), 400, { code: "invalid_cuit", field: "cuit" });
        expectErrorDeAcceso(await registrar({ ...datosNuevos(), cuit: "2012345678" }), 400, { code: "invalid_cuit", field: "cuit" });

        cuitsUsados.push("20123456786");
        expect((await registrar({ ...datosNuevos(), cuit: "20.12345678.6" })).status).toBe(201);
        expect((await registrar({ ...datosNuevos(), cuit: "20-12345678-6" })).status).toBe(201);
    });

    test('un CUIT que el padrón no tiene da 422 en el campo cuit', async () => {
        const datos = datosNuevos();
        cuitsFueraDelPadron.add(datos.cuit);

        expectErrorDeAcceso(await registrar(datos), 422, { code: "cuit_not_in_padron", field: "cuit" });
    });

    test('con el padrón caído da 502 sin campo', async () => {
        padronCaido = true;
        const res = await registrar(datosNuevos());

        expectErrorDeAcceso(res, 502, { code: "padron_unavailable" });
        expect(res.body.errors[0].field).toBeUndefined();
    });

    test('un error de validación no consulta el padrón ni crea nada', async () => {
        const consultasAntes = consultasAlPadron.length;
        const datos = { ...datosNuevos(), password: "corta" };

        expect((await registrar(datos)).status).toBe(400);
        expect(consultasAlPadron.length).toBe(consultasAntes);
        expect(await cuentaPorEmail(datos.email)).toBeUndefined();
        expect(fs.existsSync(carpetaDeClaves(datos.cuit))).toBe(false);
    });
});

describe('Tarea 4: alta sin confirmar con usuario interno', () => {
    test('la cuenta queda sin confirmar, marcada como nueva, con los datos del padrón', async () => {
        const { user, cuit } = await registrarPendiente();

        expect(user).toMatchObject({
            email_confirmado: false,
            username_interno: true,
            razon_social: `EDITORIAL ${cuit}`,
            cond_fiscal: "IVA EXENTO",
            domicilio: "DORREGO 1150, ROSARIO, SANTA FE"
        });
    });

    test('el username generado es corto, sin @ y único sin distinguir mayúsculas', async () => {
        const { user } = await registrarPendiente();
        const [{ total }] = await db
            .select({ total: sql<number>`count(*)::int` })
            .from(usersTable)
            .where(sql`lower(${usersTable.username}) = lower(${user.username})`);

        expect(user.username.length).toBeLessThanOrEqual(25);
        expect(user.username).not.toContain("@");
        expect(total).toBe(1);
    });

    test('dos registros seguidos generan usernames distintos', async () => {
        const primera = await registrarPendiente();
        const segunda = await registrarPendiente();

        expect(primera.user.username).not.toBe(segunda.user.username);
    });

    test('si el username generado ya existe (en otras mayúsculas), usa otro', async () => {
        usernamesForzados.push(SEED.username.toUpperCase(), "u_forzado_libre");

        const { user } = await registrarPendiente();

        expect(user.username).toBe("u_forzado_libre");
    });

    test('el registro no manda la bienvenida, sólo la confirmación', async () => {
        const { email } = await registrarPendiente();

        expect(mailsA(email).map((envio) => envio.alias)).toEqual(["confirmar-email"]);
    });
});

describe('Tarea 5: email y CUIT tomados vs. cuentas sin confirmar', () => {
    test('el email de una cuenta confirmada o vieja (en otras mayúsculas) está tomado', async () => {
        const confirmada = await registrarConfirmada();

        expectErrorDeAcceso(await registrar({ ...datosNuevos(), email: confirmada.email.toUpperCase() }), 409, { code: "email_taken", field: "email" });
        expectErrorDeAcceso(await registrar({ ...datosNuevos(), email: SEED.email.toUpperCase() }), 409, { code: "email_taken", field: "email" });
    });

    test('el CUIT de una cuenta confirmada o vieja está tomado', async () => {
        const confirmada = await registrarConfirmada();
        const vieja = await crearCuentaVieja();

        expectErrorDeAcceso(await registrar({ ...datosNuevos(), cuit: confirmada.cuit }), 409, { code: "cuit_taken", field: "cuit" });
        expectErrorDeAcceso(await registrar({ ...datosNuevos(), cuit: vieja.cuit }), 409, { code: "cuit_taken", field: "cuit" });
    });

    test('el mismo email que una pendiente la reemplaza, con todo lo que creó su alta', async () => {
        const pendiente = await registrarPendiente();

        const res = await registrar({ ...datosNuevos(), email: pendiente.email });

        expect(res.status).toBe(201);
        expect(await filasDeLaCuenta(pendiente.user.id)).toEqual(SIN_FILAS);
        expect(fs.existsSync(carpetaDeClaves(pendiente.cuit))).toBe(false);
        expectErrorDeAcceso(await confirmar(pendiente.token), 404, { code: "token_invalid" });
    });

    test('el mismo CUIT que una pendiente la reemplaza y las claves en disco son las de la cuenta nueva', async () => {
        const pendiente = await registrarPendiente();
        const claveVieja = fs.readFileSync(join(carpetaDeClaves(pendiente.cuit), "private_key.key"), "utf8");

        const nueva = await registrarConfirmada({ ...datosNuevos(), cuit: pendiente.cuit });

        expect(await filasDeLaCuenta(pendiente.user.id)).toEqual(SIN_FILAS);
        expectErrorDeAcceso(await confirmar(pendiente.token), 404, { code: "token_invalid" });

        const claveNueva = fs.readFileSync(join(carpetaDeClaves(pendiente.cuit), "private_key.key"), "utf8");
        expect(claveNueva).not.toBe(claveVieja);

        const [bienvenida] = mailsA(nueva.email, "bienvenida");
        const csr = forge.pki.certificationRequestFromPem(bienvenida.adjuntos[0].contenido.toString("utf8"));
        const clave = forge.pki.privateKeyFromPem(claveNueva) as forge.pki.rsa.PrivateKey;
        expect((csr.publicKey as forge.pki.rsa.PublicKey).n.equals(clave.n)).toBe(true);
    });

    test('si el email es de una pendiente y el CUIT de otra, las dos se reemplazan', async () => {
        const porEmail = await registrarPendiente();
        const porCuit = await registrarPendiente();

        expect((await registrar({ email: porEmail.email, password: PASSWORD, cuit: porCuit.cuit })).status).toBe(201);

        expect(await filasDeLaCuenta(porEmail.user.id)).toEqual(SIN_FILAS);
        expect(await filasDeLaCuenta(porCuit.user.id)).toEqual(SIN_FILAS);
    });

    test('si el registro falla, la pendiente sigue intacta con sus claves', async () => {
        const pendiente = await registrarPendiente();
        const filasAntes = await filasDeLaCuenta(pendiente.user.id);
        const confirmada = await registrarConfirmada();

        expect((await registrar({ ...datosNuevos(), email: pendiente.email, cuit: confirmada.cuit })).status).toBe(409);
        padronCaido = true;
        expect((await registrar({ ...datosNuevos(), email: pendiente.email })).status).toBe(502);
        expect((await registrar({ ...datosNuevos(), cuit: pendiente.cuit })).status).toBe(502);

        expect(await filasDeLaCuenta(pendiente.user.id)).toEqual(filasAntes);
        expect(fs.existsSync(join(carpetaDeClaves(pendiente.cuit), "private_key.key"))).toBe(true);
        expect(fs.existsSync(join(carpetaDeClaves(pendiente.cuit), "cert.csr"))).toBe(true);
    });
});

describe('Tarea 6: mail de confirmación al registrarse', () => {
    test('se manda con la razón social y un link a /verificar-email del panel', async () => {
        const { email, cuit } = await registrarPendiente();
        const [confirmacion] = mailsA(email, "confirmar-email");

        expect(confirmacion.modelo.nombre).toBe(`EDITORIAL ${cuit}`);
        expect(confirmacion.modelo.url_confirmar.startsWith(new URL("/verificar-email?token=", env.PANEL_URL).toString())).toBe(true);
    });

    test('el token no queda en claro en la base', async () => {
        const { token, user } = await registrarPendiente();
        const tokens = await db.select().from(tokensCuentaTable).where(eq(tokensCuentaTable.user, user.id));

        expect(JSON.stringify(tokens)).not.toContain(token);
        expect(tokens.map((fila) => fila.hash)).toEqual([createHash("sha256").update(token).digest("hex")]);
    });

    test('si el mail no sale, el registro responde 201 y se puede reenviar', async () => {
        const datos = datosNuevos();
        fallarEnvio = true;

        expect((await registrar(datos)).status).toBe(201);
        expect(await cuentaPorEmail(datos.email)).toMatchObject({ email_confirmado: false });

        fallarEnvio = false;
        adelantar(MINUTO);
        expect((await reenviar(datos.email)).status).toBe(202);
        expect(mailsA(datos.email, "confirmar-email")).toHaveLength(1);
    });
});

describe('Tarea 7: confirmar el email', () => {
    test('un token válido confirma la cuenta y devuelve una sesión que sirve', async () => {
        const { token, email } = await registrarPendiente();

        const res = await confirmar(token);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, status: "verified", token: expect.any(String) });
        const me = await request(app).get('/user').set('Authorization', `Bearer ${res.body.token}`);
        expect(me.status).toBe(200);
        expect(me.body.data.email).toBe(email);
        expect(await cuentaPorEmail(email)).toMatchObject({ email_confirmado: true });
    });

    test('al confirmar sale una sola bienvenida con la razón social y el CSR', async () => {
        const { email, cuit } = await registrarConfirmada();
        const bienvenidas = mailsA(email, "bienvenida");

        expect(bienvenidas).toHaveLength(1);
        expect(bienvenidas[0].modelo.nombre).toBe(`EDITORIAL ${cuit}`);
        expect(bienvenidas[0].adjuntos).toEqual([
            { nombre: `${cuit}.csr`, contenido: fs.readFileSync(join(carpetaDeClaves(cuit), "cert.csr")), tipo: "application/pkcs10" }
        ]);
    });

    test('repetir el token o usar otro de la cuenta ya confirmada da already_verified sin sesión', async () => {
        const pendiente = await registrarPendiente();
        adelantar(MINUTO);
        await reenviar(pendiente.email);
        const otroToken = ultimoTokenDeConfirmacion(pendiente.email);

        await confirmar(pendiente.token);
        const repetido = await confirmar(pendiente.token);
        const otro = await confirmar(otroToken);

        expect(repetido.status).toBe(200);
        expect(repetido.body).toEqual({ success: true, status: "already_verified" });
        expect(otro.body).toEqual({ success: true, status: "already_verified" });
        expect(mailsA(pendiente.email, "bienvenida")).toHaveLength(1);
    });

    test('un token vencido de una pendiente vencida da registration_expired y borra la cuenta', async () => {
        const pendiente = await registrarPendiente();
        adelantar(24 * HORA + MINUTO);

        expectErrorDeAcceso(await confirmar(pendiente.token), 410, { code: "registration_expired" });
        expect(await filasDeLaCuenta(pendiente.user.id)).toEqual(SIN_FILAS);
        expect(fs.existsSync(carpetaDeClaves(pendiente.cuit))).toBe(false);

        expectErrorDeAcceso(await confirmar(pendiente.token), 404, { code: "token_invalid" });
    });

    test('un token vencido de una cuenta con un link más nuevo vigente da token_expired con el email', async () => {
        const pendiente = await registrarPendiente();
        adelantar(23 * HORA);
        await reenviar(pendiente.email);
        adelantar(2 * HORA);

        expectErrorDeAcceso(await confirmar(pendiente.token), 410, { code: "token_expired", email: pendiente.email });
        expect(await cuentaPorEmail(pendiente.email)).toMatchObject({ email_confirmado: false });
    });

    test('un token vencido de una cuenta ya confirmada da already_verified', async () => {
        const pendiente = await registrarPendiente();
        adelantar(MINUTO);
        await reenviar(pendiente.email);
        await confirmar(ultimoTokenDeConfirmacion(pendiente.email));
        adelantar(25 * HORA);

        expect((await confirmar(pendiente.token)).body.status).toBe("already_verified");
    });

    test('un token inexistente, vacío o ausente da token_invalid', async () => {
        expectErrorDeAcceso(await confirmar("no-existe"), 404, { code: "token_invalid" });
        expectErrorDeAcceso(await confirmar(""), 404, { code: "token_invalid" });
        expectErrorDeAcceso(await post('/user/verify-email', {}), 404, { code: "token_invalid" });
    });

    test('si la bienvenida no sale, la confirmación responde verified igual', async () => {
        const { token } = await registrarPendiente();
        fallarEnvio = true;

        const res = await confirmar(token);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("verified");
    });
});

describe('Tarea 8: reenviar el link de confirmación', () => {
    test('con el email en cualquier mayúscula sale un mail con un token nuevo', async () => {
        const pendiente = await registrarPendiente();
        adelantar(MINUTO);

        const res = await reenviar(pendiente.email.toUpperCase());

        expect(res.status).toBe(202);
        expect(res.body).toEqual({ success: true, data: {} });
        expect(mailsA(pendiente.email, "confirmar-email")).toHaveLength(2);
        expect(ultimoTokenDeConfirmacion(pendiente.email)).not.toBe(pendiente.token);
    });

    test('después de reenviar, el link anterior todavía vigente confirma', async () => {
        const pendiente = await registrarPendiente();
        adelantar(MINUTO);
        await reenviar(pendiente.email);

        expect((await confirmar(pendiente.token)).body.status).toBe("verified");
    });

    test('reenviar corre el plazo de borrado a 24 h desde el reenvío', async () => {
        const pendiente = await registrarPendiente();
        adelantar(23 * HORA);
        await reenviar(pendiente.email);

        adelantar(HORA + MINUTO);
        await limpiar();
        expect(await cuentaPorEmail(pendiente.email)).toBeDefined();

        adelantar(23 * HORA);
        await limpiar();
        expect(await cuentaPorEmail(pendiente.email)).toBeUndefined();
    });

    test('con un email sin cuenta pendiente vigente responde igual y no manda nada', async () => {
        const confirmada = await registrarConfirmada();
        const vencida = await registrarPendiente();
        adelantar(24 * HORA + MINUTO);
        const vieja = await crearCuentaVieja();
        const enviadosAntes = enviados.length;

        for (const email of ["nadie@acceso.test", confirmada.email, vieja.email!, vencida.email]) {
            const res = await reenviar(email);
            expect(res.status).toBe(202);
            expect(res.body).toEqual({ success: true, data: {} });
        }

        expect(enviados.length).toBe(enviadosAntes);
        expect(await filasDeLaCuenta(vencida.user.id)).toEqual(SIN_FILAS);
    });

    test('sin email (aunque venga un token) da invalid_email', async () => {
        expectErrorDeAcceso(await post('/user/resend-verification', { token: "x" }), 400, { code: "invalid_email", field: "email" });
    });

    test('antes de 60 s del último mail da too_many_requests y no manda nada', async () => {
        const pendiente = await registrarPendiente();
        adelantar(59 * 1000);

        expectErrorDeAcceso(await reenviar(pendiente.email), 429, { code: "too_many_requests" });
        expect(mailsA(pendiente.email, "confirmar-email")).toHaveLength(1);
    });

    test('el 4.º reenvío dentro de 15 minutos da too_many_requests', async () => {
        const pendiente = await registrarPendiente();

        for (let reenvio = 0; reenvio < 3; reenvio++) {
            adelantar(MINUTO);
            expect((await reenviar(pendiente.email)).status).toBe(202);
        }
        adelantar(MINUTO);

        expectErrorDeAcceso(await reenviar(pendiente.email), 429, { code: "too_many_requests" });
        expect(mailsA(pendiente.email, "confirmar-email")).toHaveLength(4);
    });
});

describe('Tarea 9: borrado de cuentas sin confirmar vencidas', () => {
    test('pasadas 24 h desde el último link, la limpieza borra la cuenta, lo que creó su alta y sus claves', async () => {
        const pendiente = await registrarPendiente();
        expect(fs.existsSync(carpetaDeClaves(pendiente.cuit))).toBe(true);

        adelantar(24 * HORA + MINUTO);
        await limpiar();

        expect(await filasDeLaCuenta(pendiente.user.id)).toEqual(SIN_FILAS);
        expect(fs.existsSync(carpetaDeClaves(pendiente.cuit))).toBe(false);
    });

    test('a las 23 h 59 min la limpieza no la borra', async () => {
        const pendiente = await registrarPendiente();

        adelantar(23 * HORA + 59 * MINUTO);
        await limpiar();

        expect(await cuentaPorEmail(pendiente.email)).toBeDefined();
    });

    test('nunca borra cuentas viejas ni confirmadas, ni toca datos o claves de otras cuentas', async () => {
        const conLinksVencidos = await registrarPendiente();
        adelantar(MINUTO);
        await reenviar(conLinksVencidos.email);
        await confirmar(conLinksVencidos.token);
        const vieja = await crearCuentaVieja();
        const filasAntes = await filasDeLaCuenta(conLinksVencidos.user.id);
        const pendiente = await registrarPendiente();

        adelantar(48 * HORA);
        await limpiar();

        expect(await cuentaPorEmail(pendiente.email)).toBeUndefined();
        expect(await filasDeLaCuenta(conLinksVencidos.user.id)).toEqual(filasAntes);
        expect(fs.existsSync(join(carpetaDeClaves(conLinksVencidos.cuit), "private_key.key"))).toBe(true);
        expect(await cuentaPorEmail(vieja.email!)).toBeDefined();
        expect(await cuentaPorEmail(SEED.email)).toBeDefined();
    });

    test('si borrar una cuenta falla, las demás pendientes vencidas se borran igual', async () => {
        const bloqueada = await registrarPendiente();
        const otra = await registrarPendiente();
        await db.insert(coleccionesTable).values({ titulo: "Bloquea el borrado", user: bloqueada.user.id });
        const errores = vi.spyOn(console, "error").mockImplementation(() => undefined);

        adelantar(24 * HORA + MINUTO);
        await limpiar();
        errores.mockRestore();

        expect(await cuentaPorEmail(bloqueada.email)).toBeDefined();
        expect(await cuentaPorEmail(otra.email)).toBeUndefined();

        await db.delete(coleccionesTable).where(eq(coleccionesTable.user, bloqueada.user.id));
    });

    test('se programa al arrancar, corre en ese momento y después cada una hora', () => {
        const limpiarSpy = vi.fn(async () => undefined);
        const programar = vi.fn();

        startLimpiezaCuentasPendientes({ limpiar: limpiarSpy, programar });

        expect(limpiarSpy).toHaveBeenCalledTimes(1);
        expect(programar).toHaveBeenCalledWith(expect.any(Function), HORA);
        programar.mock.calls[0][0]();
        expect(limpiarSpy).toHaveBeenCalledTimes(2);
    });

    test('una pendiente vencida todavía no borrada: login da 401 y forgot-password no manda nada; las dos la borran', async () => {
        const paraLogin = await registrarPendiente();
        const paraRestablecer = await registrarPendiente();
        adelantar(24 * HORA + MINUTO);
        const enviadosAntes = enviados.length;

        expectErrorDeAcceso(await login(paraLogin.email, PASSWORD), 401, { code: "invalid_credentials" });
        expect((await pedirRestablecer(paraRestablecer.email)).status).toBe(202);

        expect(enviados.length).toBe(enviadosAntes);
        expect(await filasDeLaCuenta(paraLogin.user.id)).toEqual(SIN_FILAS);
        expect(await filasDeLaCuenta(paraRestablecer.user.id)).toEqual(SIN_FILAS);
    });

    test('un link de restablecer de una cuenta que pasó a ser pendiente vencida da token_invalid', async () => {
        const paraConsultar = await registrarPendiente();
        const paraGuardar = await registrarPendiente();
        await pedirRestablecer(paraConsultar.email);
        await pedirRestablecer(paraGuardar.email);
        adelantar(24 * HORA + MINUTO);

        expectErrorDeAcceso(await consultarRestablecer(ultimoTokenDeRestablecer(paraConsultar.email)), 404, { code: "token_invalid" });
        expectErrorDeAcceso(await restablecer(ultimoTokenDeRestablecer(paraGuardar.email), "nueva12345"), 404, { code: "token_invalid" });
    });
});

describe('Tarea 10: login por email o usuario', () => {
    test('una cuenta vieja entra con su username exacto, no con otras mayúsculas ni espacios', async () => {
        expect((await login(SEED.username, PASSWORD_SEED)).status).toBe(200);
        expectErrorDeAcceso(await login(SEED.username.toUpperCase(), PASSWORD_SEED), 401, { code: "invalid_credentials" });
        expectErrorDeAcceso(await login(` ${SEED.username} `, PASSWORD_SEED), 401, { code: "invalid_credentials" });
    });

    test('se entra con el email en mayúsculas y con espacios en los extremos', async () => {
        const res = await login(`  ${SEED.email.toUpperCase()} `, PASSWORD_SEED);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, message: "login exitoso", token: expect.any(String) });
    });

    test('una cuenta vieja sin email sigue entrando con su username', async () => {
        const vieja = await crearCuentaVieja(null);

        expect((await login(vieja.username, PASSWORD)).status).toBe(200);
    });

    test('una cuenta nueva sin confirmar: con la contraseña correcta da email_not_verified, con la incorrecta invalid_credentials', async () => {
        const pendiente = await registrarPendiente();

        expectErrorDeAcceso(await login(pendiente.email, PASSWORD), 403, { code: "email_not_verified", email: pendiente.email });
        expectErrorDeAcceso(await login(pendiente.email, "otra-clave"), 401, { code: "invalid_credentials" });
    });

    test('las cuentas viejas nunca reciben email_not_verified, aunque no figuren confirmadas', async () => {
        const vieja = await crearCuentaVieja();
        await db.update(usersTable).set({ email_confirmado: false }).where(eq(usersTable.id, vieja.id));

        expect((await login(vieja.email!, PASSWORD)).status).toBe(200);
    });
});

describe('Tarea 11: email único al editar el perfil', () => {
    const sesionDe = async (identifier: string) => (await login(identifier, PASSWORD)).body.token;
    const actualizar = (token: string, body: object) => request(app).put('/user').set('Authorization', `Bearer ${token}`).send(body);

    test('el email se normaliza al guardarlo', async () => {
        const vieja = await crearCuentaVieja();

        const res = await actualizar(await sesionDe(vieja.username), { email: " Otro-Perfil@X.com " });

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe("otro-perfil@x.com");
    });

    test('el email de otra cuenta (en cualquier mayúscula) está tomado y no se cambia', async () => {
        const vieja = await crearCuentaVieja();
        const otra = await crearCuentaVieja();

        expectErrorDeAcceso(await actualizar(await sesionDe(vieja.username), { email: otra.email!.toUpperCase() }), 409, {
            code: "email_taken",
            field: "email"
        });
        expect(await cuentaPorEmail(vieja.email!)).toBeDefined();
    });

    test('guardar el propio email con otras mayúsculas no es error', async () => {
        const vieja = await crearCuentaVieja();

        const res = await actualizar(await sesionDe(vieja.username), { email: vieja.email!.toUpperCase() });

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe(vieja.email);
    });
});

describe('Tarea 12: pedir restablecer la contraseña', () => {
    test('a una cuenta existente (confirmada, vieja o pendiente vigente) le sale un único mail con el link', async () => {
        const confirmada = await registrarConfirmada();
        const vieja = await crearCuentaVieja();
        const pendiente = await registrarPendiente();

        for (const email of [confirmada.email, vieja.email!, pendiente.email]) {
            const res = await pedirRestablecer(email.toUpperCase());

            expect(res.status).toBe(202);
            expect(res.body).toEqual({ success: true, data: {} });
            const mails = mailsA(email, "restablecer-contrasena");
            expect(mails).toHaveLength(1);
            expect(mails[0].modelo.url_restablecer.startsWith(new URL("/restablecer-contrasena?token=", env.PANEL_URL).toString())).toBe(true);
        }
    });

    test('a un email sin cuenta le responde igual sin mandar nada', async () => {
        const enviadosAntes = enviados.length;
        const res = await pedirRestablecer("nadie-restablecer@acceso.test");

        expect(res.status).toBe(202);
        expect(res.body).toEqual({ success: true, data: {} });
        expect(enviados.length).toBe(enviadosAntes);
    });

    test('la cuenta vieja lleva su usuario; la nueva sólo la razón social', async () => {
        const vieja = await crearCuentaVieja();
        const nueva = await registrarConfirmada();

        await pedirRestablecer(vieja.email!);
        await pedirRestablecer(nueva.email);

        expect(mailsA(vieja.email!, "restablecer-contrasena")[0].modelo.cuenta).toBe(`${vieja.razon_social} (usuario ${vieja.username})`);
        expect(mailsA(nueva.email, "restablecer-contrasena")[0].modelo.cuenta).toBe(`EDITORIAL ${nueva.cuit}`);
    });

    test('el token no queda en claro en la base', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);
        const token = ultimoTokenDeRestablecer(vieja.email!);

        const tokens = await db.select().from(tokensCuentaTable).where(eq(tokensCuentaTable.user, vieja.id));
        expect(JSON.stringify(tokens)).not.toContain(token);
    });

    test('antes de 60 s del pedido anterior da too_many_requests, exista o no la cuenta', async () => {
        const vieja = await crearCuentaVieja();

        for (const email of [vieja.email!, "nadie-60s@acceso.test"]) {
            expect((await pedirRestablecer(email)).status).toBe(202);
            adelantar(30 * 1000);
            expectErrorDeAcceso(await pedirRestablecer(email), 429, { code: "too_many_requests" });
        }
        expect(mailsA(vieja.email!, "restablecer-contrasena")).toHaveLength(1);
    });

    test('el 4.º pedido dentro de 15 minutos da too_many_requests, exista o no la cuenta', async () => {
        const vieja = await crearCuentaVieja();

        for (const email of [vieja.email!, "nadie-15min@acceso.test"]) {
            for (let pedido = 0; pedido < 3; pedido++) {
                expect((await pedirRestablecer(email)).status).toBe(202);
                adelantar(MINUTO);
            }
            expectErrorDeAcceso(await pedirRestablecer(email), 429, { code: "too_many_requests" });
        }
    });

    test('un email con formato inválido da invalid_email', async () => {
        expectErrorDeAcceso(await pedirRestablecer("no-es-un-email"), 400, { code: "invalid_email", field: "email" });
    });
});

describe('Tarea 13: consultar un link de restablecer', () => {
    test('un token válido de una cuenta vieja trae razón social y usuario; de una nueva, usuario null', async () => {
        const vieja = await crearCuentaVieja();
        const nueva = await registrarConfirmada();
        await pedirRestablecer(vieja.email!);
        await pedirRestablecer(nueva.email);

        const deLaVieja = await consultarRestablecer(ultimoTokenDeRestablecer(vieja.email!));
        const deLaNueva = await consultarRestablecer(ultimoTokenDeRestablecer(nueva.email));

        expect(deLaVieja.status).toBe(200);
        expect(deLaVieja.body).toEqual({ success: true, status: "valid", razon_social: vieja.razon_social, username: vieja.username });
        expect(deLaNueva.body).toEqual({ success: true, status: "valid", razon_social: `EDITORIAL ${nueva.cuit}`, username: null });
    });

    test('consultar no consume el token', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);
        const token = ultimoTokenDeRestablecer(vieja.email!);

        expect((await consultarRestablecer(token)).body.status).toBe("valid");
        expect((await consultarRestablecer(token)).body.status).toBe("valid");
    });

    test('un token de más de 1 h da token_expired con el email', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);
        adelantar(HORA + MINUTO);

        expectErrorDeAcceso(await consultarRestablecer(ultimoTokenDeRestablecer(vieja.email!)), 410, { code: "token_expired", email: vieja.email });
    });

    test('un token usado, o de una cuenta que usó otro, da token_used aunque además haya vencido', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);
        const anterior = ultimoTokenDeRestablecer(vieja.email!);
        adelantar(MINUTO);
        await pedirRestablecer(vieja.email!);
        const usado = ultimoTokenDeRestablecer(vieja.email!);
        expect((await restablecer(usado, "nueva12345")).status).toBe(200);

        expectErrorDeAcceso(await consultarRestablecer(usado), 409, { code: "token_used" });
        expectErrorDeAcceso(await consultarRestablecer(anterior), 409, { code: "token_used" });

        adelantar(2 * HORA);
        expectErrorDeAcceso(await consultarRestablecer(usado), 409, { code: "token_used" });
    });

    test('un token inexistente da token_invalid', async () => {
        expectErrorDeAcceso(await consultarRestablecer("no-existe"), 404, { code: "token_invalid" });
    });
});

describe('Tarea 14: guardar la contraseña nueva', () => {
    test('cambia la contraseña y devuelve sesión; después entra con la nueva y no con la vieja', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);

        const res = await restablecer(ultimoTokenDeRestablecer(vieja.email!), "nueva12345");

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, status: "password_reset", token: expect.any(String) });
        expect((await request(app).get('/user').set('Authorization', `Bearer ${res.body.token}`)).status).toBe(200);
        expect((await login(vieja.username, "nueva12345")).status).toBe(200);
        expectErrorDeAcceso(await login(vieja.username, PASSWORD), 401, { code: "invalid_credentials" });
    });

    test('el mismo token otra vez, u otro emitido antes, da token_used en GET y en POST', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);
        const anterior = ultimoTokenDeRestablecer(vieja.email!);
        adelantar(MINUTO);
        await pedirRestablecer(vieja.email!);
        const usado = ultimoTokenDeRestablecer(vieja.email!);
        await restablecer(usado, "nueva12345");

        expectErrorDeAcceso(await restablecer(usado, "otra123456"), 409, { code: "token_used" });
        expectErrorDeAcceso(await restablecer(anterior, "otra123456"), 409, { code: "token_used" });
        expectErrorDeAcceso(await consultarRestablecer(anterior), 409, { code: "token_used" });
    });

    test('una contraseña de 7 caracteres da password_too_short y el token sigue valid', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);
        const token = ultimoTokenDeRestablecer(vieja.email!);

        expectErrorDeAcceso(await restablecer(token, "1234567"), 400, { code: "password_too_short", field: "password" });
        expect((await consultarRestablecer(token)).body.status).toBe("valid");
    });

    test('con el token vencido da token_expired con el email y no cambia la contraseña', async () => {
        const vieja = await crearCuentaVieja();
        await pedirRestablecer(vieja.email!);
        adelantar(HORA + MINUTO);

        expectErrorDeAcceso(await restablecer(ultimoTokenDeRestablecer(vieja.email!), "nueva12345"), 410, { code: "token_expired", email: vieja.email });
        expect((await login(vieja.username, PASSWORD)).status).toBe(200);
    });

    test('una cuenta nueva sin confirmar queda confirmada, recibe la bienvenida y ya no se borra', async () => {
        const pendiente = await registrarPendiente();
        await pedirRestablecer(pendiente.email);

        expect((await restablecer(ultimoTokenDeRestablecer(pendiente.email), "nueva12345")).status).toBe(200);

        expect(await cuentaPorEmail(pendiente.email)).toMatchObject({ email_confirmado: true });
        expect(mailsA(pendiente.email, "bienvenida")).toHaveLength(1);
        expect((await confirmar(pendiente.token)).body).toEqual({ success: true, status: "already_verified" });

        adelantar(25 * HORA);
        await limpiar();
        expect(await cuentaPorEmail(pendiente.email)).toBeDefined();
    });

    test('una cuenta confirmada o vieja no recibe bienvenida al restablecer', async () => {
        const confirmada = await registrarConfirmada();
        const vieja = await crearCuentaVieja();

        for (const email of [confirmada.email, vieja.email!]) {
            await pedirRestablecer(email);
            await restablecer(ultimoTokenDeRestablecer(email), "nueva12345");
        }

        expect(mailsA(confirmada.email, "bienvenida")).toHaveLength(1);
        expect(mailsA(vieja.email!, "bienvenida")).toHaveLength(0);
    });
});
