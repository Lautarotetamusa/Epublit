import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { and, eq } from 'drizzle-orm';

dotenv.config({ path: join(__dirname, '../.env') });

import { db } from '../src/db/client';
import { createContainer } from '../src/container';
import { createApp } from '../src/app';
import { createMockAfipService } from '../src/lib/afip/Afip.mock';
import { fechaDeFecha, mesDeFecha } from '../src/lib/fechaArgentina';
import { hashToken } from '../src/lib/crypto/tokens';
import { createAdminService } from '../src/modules/admin/admin.service';
import type { AdminRepository } from '../src/modules/admin/admin.repository';
import {
    clientesTable,
    comprobantesTable,
    contenidoBloquesTable,
    contenidoPaginasTable,
    integrationsTable,
    libroResenasTable,
    librosTable,
    liquidacionesTable,
    movimientosLibrosTable,
    movimientosTable,
    ordersTable,
    personasTable,
    tiposEdicionTable,
    tokensCuentaTable,
    usersTable
} from '../src/db/schema';
import { expectErrorResponse, registrarCuentaConfirmada } from './util';

const container = createContainer({ afipService: createMockAfipService() });
const app = createApp(container);

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const haceDias = (dias: number): Date => new Date(Date.now() - dias * MS_POR_DIA);
const emailDe = (n: number): string => `admin-panel-${n}@test.com`;
// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- contraseña de cuentas de prueba
const password = "panel12345";
// eslint-disable-next-line sonarjs/no-hardcoded-passwords -- contraseña inválida de prueba
const passwordIncorrecta = "incorrecta123";

// CUIT con dígito verificador válido para no chocar con los fijos de otros
// archivos de test que comparten la misma base.
const cuitDe = (n: number): string => {
    const base = `2099${String(n).padStart(6, "0")}`;
    const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const suma = base.split("").reduce((acc, digito, indice) => acc + Number(digito) * pesos[indice], 0);
    const resto = 11 - (suma % 11);
    let verificador = resto;
    if (resto === 11) verificador = 0;
    if (resto === 10) verificador = 9;

    return `${base}${verificador}`;
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let adminToken: string;
let editorialToken: string;
let editorialId: number;
let adminId: number;
let uOpsId: number;
let uVentaId: number;
let uContenidoId: number;
let uNoConfirmadaEmail: string;

const registrar = async (n: number) =>
    registrarCuentaConfirmada(app, { email: emailDe(n), password, cuit: cuitDe(n) });

const tipoNormalDe = async (userId: number): Promise<number> => {
    const [tipo] = await db
        .select({ id: tiposEdicionTable.id })
        .from(tiposEdicionTable)
        .where(and(eq(tiposEdicionTable.user, userId), eq(tiposEdicionTable.nombre, "Normal")))
        .limit(1);

    return tipo.id;
};

const insertarLibro = async (userId: number, isbnLibro: string, createdAt: Date): Promise<number> => {
    const [libro] = await db
        .insert(librosTable)
        .values({
            isbn: isbnLibro,
            titulo: `Libro ${isbnLibro}`,
            fecha_edicion: "2020-01-01",
            precio: 1000,
            tipo_edicion_id: await tipoNormalDe(userId),
            created_at: createdAt,
            user: userId
        })
        .returning({ id: librosTable.id_libro });

    return libro.id;
};

const insertarMovimiento = async (
    userId: number,
    tipo: "ingreso" | "venta" | "ventaConsignacion" | "devolucion" | "consignacion",
    fecha: Date,
    esMigracion = false
): Promise<number> => {
    const [movimiento] = await db
        .insert(movimientosTable)
        .values({
            tipo,
            origen_tipo: "exterior",
            destino_tipo: "exterior",
            fecha,
            es_migracion: esMigracion,
            user: userId
        })
        .returning({ id: movimientosTable.id });

    return movimiento.id;
};

const insertarPedido = async (userId: number, fecha: Date): Promise<void> => {
    const [integracion] = await db
        .insert(integrationsTable)
        .values({
            user: userId,
            nombre: `Integración panel ${userId}`,
            origen: "https://panel.test",
            prefijo: `pnl${userId}`,
            clave_hash: `hash-panel-${userId}-${Date.now()}`,
            creada_en: haceDias(200)
        })
        .returning({ id: integrationsTable.id });

    await db.insert(ordersTable).values({
        user: userId,
        integracion_id: integracion.id,
        codigo: `PED-PANEL-${userId}`,
        referencia_externa: `ref-panel-${userId}-${Date.now()}`,
        clave_idempotencia: `idem-panel-${userId}`,
        comprador_nombre: "Comprador Panel",
        comprador_email: "comprador@panel.test",
        entrega_tipo: "retiro",
        subtotal: 1000,
        total: 1000,
        creado_en: fecha
    });
};

const insertarPagina = async (userId: number, creada: Date, actualizada: Date): Promise<number> => {
    const [pagina] = await db
        .insert(contenidoPaginasTable)
        .values({
            user: userId,
            titulo: `Página ${creada.getTime()}`,
            creada_en: creada,
            actualizada_en: actualizada,
            actualizada_por: userId
        })
        .returning({ id: contenidoPaginasTable.id });

    return pagina.id;
};

const insertarComprobante = async (userId: number, movimientoId: number): Promise<void> => {
    await db.insert(comprobantesTable).values({
        user: userId,
        tipo: "remito",
        movimiento_id: movimientoId,
        punto_venta: 1,
        emisor: {
            razonSocial: "Editorial Panel",
            cuit: cuitDe(1),
            condicionFiscal: "RESPONSABLE INSCRIPTO",
            domicilio: "Calle 1",
            ingresosBrutos: null,
            inicioActividades: "01/01/2020",
            email: null,
            logoUrl: null
        },
        receptor: {
            razonSocial: "CONSUMIDOR FINAL",
            cuit: null,
            documento: null,
            condicionFiscal: "CONSUMIDOR FINAL",
            domicilio: "",
            condicionVenta: null
        },
        items: []
    });
};

const prepararOperaciones = async (): Promise<void> => {
    const uOps = await registrar(101);
    uOpsId = uOps.userId;
    await db.update(usersTable).set({ created_at: haceDias(100) }).where(eq(usersTable.id, uOpsId));

    const libroId = await insertarLibro(uOpsId, "9789900000101", haceDias(1));
    await db.insert(personasTable).values({
        dni: "99000101",
        nombre: "Persona Panel",
        user: uOpsId,
        created_at: haceDias(2)
    });
    await db.insert(clientesTable).values({
        nombre: "Cliente Panel",
        razon_social: "Cliente Panel",
        cond_fiscal: "CONSUMIDOR FINAL",
        domicilio: "",
        user: uOpsId,
        created_at: haceDias(2)
    });

    await insertarMovimiento(uOpsId, "ingreso", haceDias(10));
    await insertarMovimiento(uOpsId, "ingreso", haceDias(5), true);
    const ventaId = await insertarMovimiento(uOpsId, "venta", haceDias(3));
    await insertarComprobante(uOpsId, ventaId);
    await insertarMovimiento(uOpsId, "devolucion", haceDias(2));
    await insertarMovimiento(uOpsId, "consignacion", haceDias(1));
    await insertarMovimiento(uOpsId, "ventaConsignacion", haceDias(1));
    await insertarMovimiento(uOpsId, "ingreso", haceDias(100));
    await insertarMovimiento(uOpsId, "ingreso", new Date(Date.now() + 2 * MS_POR_DIA));

    await insertarPedido(uOpsId, haceDias(4));
    await db.insert(libroResenasTable).values({
        id_libro: libroId,
        url: "https://resena.test/libro",
        created_at: haceDias(6),
        user: uOpsId
    });

    const paginaId = await insertarPagina(uOpsId, haceDias(20), haceDias(2));
    await db.insert(contenidoBloquesTable).values({
        user: uOpsId,
        pagina_id: paginaId,
        tipo: "texto",
        posicion: 0,
        contenido: { texto: "bloque que no suma" }
    });
    await db.insert(liquidacionesTable).values({
        codigo: "LIQ-PANEL-101",
        desde: "2024-01-01",
        hasta: "2024-01-31",
        fecha_generacion: haceDias(7),
        user: uOpsId
    });

    const uVenta = await registrar(102);
    uVentaId = uVenta.userId;
    await db.update(usersTable).set({ created_at: haceDias(100) }).where(eq(usersTable.id, uVentaId));

    const librosVenta = await Promise.all([
        insertarLibro(uVentaId, "9789900000102", haceDias(120)),
        insertarLibro(uVentaId, "9789900000103", haceDias(120)),
        insertarLibro(uVentaId, "9789900000104", haceDias(120))
    ]);
    const ventaMultiple = await insertarMovimiento(uVentaId, "venta", haceDias(3));
    await db.insert(movimientosLibrosTable).values(
        librosVenta.map((idLibro) => ({
            movimiento_id: ventaMultiple,
            id_libro: idLibro,
            cantidad: 1,
            precio: 1000,
            user: uVentaId
        }))
    );
    await insertarMovimiento(uVentaId, "devolucion", haceDias(2));
    await insertarMovimiento(uVentaId, "consignacion", haceDias(1));

    const uContenido = await registrar(103);
    uContenidoId = uContenido.userId;
    await db.update(usersTable).set({ created_at: haceDias(100) }).where(eq(usersTable.id, uContenidoId));
    const paginaContenido = await insertarPagina(uContenidoId, haceDias(20), haceDias(2));
    await db.insert(contenidoBloquesTable).values({
        user: uContenidoId,
        pagina_id: paginaContenido,
        tipo: "texto",
        posicion: 0,
        contenido: { texto: "sólo bloques no suman" }
    });
};

const listarTodas = async (token: string, params: Record<string, string> = {}) => {
    const items: Record<string, unknown>[] = [];
    let total = 0;
    let pagina = 1;

    do {
        const res = await request(app).get('/admin/cuentas').query({ ...params, pagina }).set(auth(token));
        expect(res.status).toBe(200);
        items.push(...res.body.cuentas);
        total = res.body.total;
        pagina += 1;
        if (pagina > 200) throw new Error("Paginación sin fin");
    } while (items.length < total);

    return { items, total };
};

const cuentaDe = async (token: string, email: string) => {
    const res = await request(app).get('/admin/cuentas').query({ q: email }).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);

    return res.body.cuentas[0];
};

beforeAll(async () => {
    const admin = await registrar(1);
    adminId = admin.userId;
    adminToken = admin.token;
    await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, adminId));

    const editorial = await registrar(2);
    editorialId = editorial.userId;
    editorialToken = editorial.token;

    // Cuentas suficientes para probar la paginación fija de 10 sin depender de
    // lo que hayan dejado otros archivos de test.
    await db.insert(usersTable).values(
        Array.from({ length: 12 }, (_, indice) => ({
            username: `panel_pagina_${indice}`,
            password: "x",
            cuit: cuitDe(200 + indice),
            cond_fiscal: "RESPONSABLE INSCRIPTO",
            razon_social: `Página ${String(indice).padStart(2, "0")}`,
            domicilio: "Calle Falsa 123",
            fecha_inicio: "01/01/2020",
            email: `admin-panel-page-${String(indice).padStart(2, "0")}@test.com`,
            email_confirmado: true,
            created_at: haceDias(3)
        }))
    );

    const noConfirmada = await request(app)
        .post('/user/register')
        .send({ email: emailDe(104), password, cuit: cuitDe(104) });
    expect(noConfirmada.status).toBe(201);
    uNoConfirmadaEmail = emailDe(104);

    await prepararOperaciones();
});

afterAll(() => {
    db.$client.end();
});

describe('acceso a administración', () => {
    test('sin sesión y con token inválido devuelve 401 unauthorized', async () => {
        const sinToken = await request(app).get('/admin/resumen');
        expectErrorResponse(sinToken, 401);
        expect(sinToken.body.errors[0]).toMatchObject({ code: "unauthorized" });

        const invalido = await request(app).get('/admin/resumen').set(auth("token-invalido"));
        expectErrorResponse(invalido, 401);
        expect(invalido.body.errors[0]).toMatchObject({ code: "unauthorized" });
    });

    test('una cuenta editorial recibe 403 admin_required y el admin recibe 200', async () => {
        const editorial = await request(app).get('/admin/resumen').set(auth(editorialToken));
        expectErrorResponse(editorial, 403);
        expect(editorial.body.errors[0]).toMatchObject({ code: "admin_required", message: "Acceso restringido" });

        const admin = await request(app).get('/admin/resumen').set(auth(adminToken));
        expect(admin.status).toBe(200);
    });

    test('el cambio de rol impacta en la siguiente consulta sin volver a loguearse', async () => {
        await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, editorialId));
        const habilitada = await request(app).get('/admin/embudo').set(auth(editorialToken));
        expect(habilitada.status).toBe(200);

        await db.update(usersTable).set({ role: "editorial" }).where(eq(usersTable.id, editorialId));
        const bloqueada = await request(app).get('/admin/embudo').set(auth(editorialToken));
        expectErrorResponse(bloqueada, 403);
        expect(bloqueada.body.errors[0].code).toBe("admin_required");
    });

    test('una cuenta editorial sigue usando la API existente', async () => {
        const res = await request(app).get('/rol').set(auth(editorialToken));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('último ingreso', () => {
    test('sólo un login exitoso actualiza last_login_at', async () => {
        const datos = { email: emailDe(105), password, cuit: cuitDe(105) };
        const alta = await request(app).post('/user/register').send(datos);
        expect(alta.status).toBe(201);

        const [inicial] = await db
            .select({ id: usersTable.id, last_login_at: usersTable.last_login_at })
            .from(usersTable)
            .where(eq(usersTable.email, datos.email));
        expect(inicial.last_login_at).toBeNull();

        const incorrecta = await request(app)
            .post('/user/login')
            .send({ identifier: datos.email, password: passwordIncorrecta });
        expect(incorrecta.status).toBe(401);

        const sinConfirmar = await request(app)
            .post('/user/login')
            .send({ identifier: datos.email, password });
        expect(sinConfirmar.status).toBe(403);

        const [despuesDeFallos] = await db
            .select({ last_login_at: usersTable.last_login_at })
            .from(usersTable)
            .where(eq(usersTable.id, inicial.id));
        expect(despuesDeFallos.last_login_at).toBeNull();

        await db.update(usersTable).set({ email_confirmado: true }).where(eq(usersTable.id, inicial.id));

        const exitoso = await request(app).post('/user/login').send({ identifier: datos.email, password });
        expect(exitoso.status).toBe(200);
        expect(exitoso.body.token).toBeTruthy();

        const [despuesExitoso] = await db
            .select({ last_login_at: usersTable.last_login_at })
            .from(usersTable)
            .where(eq(usersTable.id, inicial.id));
        expect(despuesExitoso.last_login_at).not.toBeNull();

        const otroFallo = await request(app)
            .post('/user/login')
            .send({ identifier: datos.email, password: passwordIncorrecta });
        expect(otroFallo.status).toBe(401);

        const [final] = await db
            .select({ last_login_at: usersTable.last_login_at })
            .from(usersTable)
            .where(eq(usersTable.id, inicial.id));
        expect(final.last_login_at).toEqual(despuesExitoso.last_login_at);
    });

    test('confirmar el email y restablecer la contraseña no registran un ingreso', async () => {
        const datos = { email: emailDe(106), password, cuit: cuitDe(106) };
        const alta = await request(app).post('/user/register').send(datos);
        expect(alta.status).toBe(201);

        const [user] = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.email, datos.email));

        const ahora = new Date();
        const vence = new Date(ahora.getTime() + 60 * 60 * 1000);

        await db.insert(tokensCuentaTable).values({
            user: user.id,
            tipo: "confirmar_email",
            hash: hashToken("token-verificar-panel"),
            creado_en: ahora,
            vence_en: vence
        });

        const verificado = await request(app)
            .post('/user/verify-email')
            .send({ token: "token-verificar-panel" });
        expect(verificado.status).toBe(200);
        expect(verificado.body.token).toBeTruthy();

        const [trasVerificar] = await db
            .select({ last_login_at: usersTable.last_login_at })
            .from(usersTable)
            .where(eq(usersTable.id, user.id));
        expect(trasVerificar.last_login_at).toBeNull();

        await db.insert(tokensCuentaTable).values({
            user: user.id,
            tipo: "restablecer_contrasena",
            hash: hashToken("token-reset-panel"),
            creado_en: ahora,
            vence_en: vence
        });

        const restablecido = await request(app)
            .post('/user/reset-password')
            .send({ token: "token-reset-panel", password });
        expect(restablecido.status).toBe(200);

        const [trasReset] = await db
            .select({ last_login_at: usersTable.last_login_at })
            .from(usersTable)
            .where(eq(usersTable.id, user.id));
        expect(trasReset.last_login_at).toBeNull();
    });
});

describe('operaciones y métricas por cuenta', () => {
    test('cuenta un movimiento por acción y excluye migración, comprobantes y filas derivadas', async () => {
        const cuenta = await cuentaDe(adminToken, emailDe(101));

        expect(cuenta).toMatchObject({
            libros: 1,
            ventas30d: 2,
            ventaHistorica: true,
            operaciones30d: 12,
            estado: "activo",
            arcaConectado: false
        });
        expect(cuenta.primeraFechaLibro).toBe(fechaDeFecha(haceDias(1)));
        expect(cuenta.primeraFechaMovimiento).toBe(fechaDeFecha(haceDias(100)));
        expect(cuenta.ultimaOperacion).toBe(fechaDeFecha(haceDias(1)));
        expect(cuenta.alta).toBe(fechaDeFecha(haceDias(100)));
    });

    test('una venta con varias líneas cuenta como una venta y las devoluciones/consignaciones no son ventas', async () => {
        const cuenta = await cuentaDe(adminToken, emailDe(102));

        expect(cuenta).toMatchObject({
            libros: 3,
            ventas30d: 1,
            ventaHistorica: true,
            operaciones30d: 3,
            estado: "activo"
        });
        expect(cuenta.primeraFechaMovimiento).toBe(fechaDeFecha(haceDias(3)));
        expect(cuenta.primeraFechaLibro).toBe(fechaDeFecha(haceDias(120)));
    });

    test('el contenido cuenta una vez por página y editarlo mueve la operación', async () => {
        const antes = await cuentaDe(adminToken, emailDe(103));
        expect(antes.operaciones30d).toBe(1);
        expect(antes.ultimaOperacion).toBe(fechaDeFecha(haceDias(2)));
        expect(antes.libros).toBe(0);
        expect(antes.estado).toBe("activo");

        await db
            .update(contenidoPaginasTable)
            .set({ actualizada_en: haceDias(1) })
            .where(eq(contenidoPaginasTable.user, uContenidoId));

        const despues = await cuentaDe(adminToken, emailDe(103));
        expect(despues.operaciones30d).toBe(1);
        expect(despues.ultimaOperacion).toBe(fechaDeFecha(haceDias(1)));

        await db
            .update(contenidoPaginasTable)
            .set({ deleted_at: new Date() })
            .where(eq(contenidoPaginasTable.user, uContenidoId));

        const dadaDeBaja = await cuentaDe(adminToken, emailDe(103));
        expect(dadaDeBaja.operaciones30d).toBe(1);
    });

    test('una cuenta recién registrada con sólo clientes por defecto está inactiva', async () => {
        const cuenta = await cuentaDe(adminToken, emailDe(1));
        expect(cuenta.operaciones30d).toBe(0);
        expect(cuenta.libros).toBe(0);
        expect(cuenta.ventas30d).toBe(0);
        expect(cuenta.estado).toBe("inactivo");
        expect(cuenta.ventaHistorica).toBe(false);
        expect(cuenta.ultimaOperacion).toBeNull();
    });

    test('editar o dar de baja no cambia la fecha de alta de libros, personas y clientes', async () => {
        const usuario = await registrar(108);
        const authUsuario = auth(usuario.token);

        const libro = await request(app).post('/libro/').set(authUsuario).send({
            isbn: "9789900000108",
            titulo: "Alta del libro",
            fecha_edicion: "2020-01-01",
            precio: 100
        });
        expect(libro.status).toBe(201);

        const persona = await request(app).post('/persona/').set(authUsuario).send({
            nombre: "Alta de persona",
            dni: "99000108"
        });
        expect(persona.status).toBe(201);

        const cliente = await request(app).post('/cliente/').set(authUsuario).send({
            nombre: "Alta de cliente",
            cuit: cuitDe(109)
        });
        expect(cliente.status).toBe(201);

        const [libroAntes] = await db
            .select({ created_at: librosTable.created_at })
            .from(librosTable)
            .where(and(eq(librosTable.user, usuario.userId), eq(librosTable.isbn, "9789900000108")));
        const [personaAntes] = await db
            .select({ created_at: personasTable.created_at })
            .from(personasTable)
            .where(eq(personasTable.id, persona.body.data.id));
        const [clienteAntes] = await db
            .select({ created_at: clientesTable.created_at })
            .from(clientesTable)
            .where(eq(clientesTable.id, cliente.body.data.id));

        await request(app).put('/libro/9789900000108').set(authUsuario).send({
            titulo: "Título editado",
            fecha_edicion: "2020-01-01",
            precio: 200
        });
        await request(app).put(`/persona/${persona.body.data.id}`).set(authUsuario).send({ nombre: "Persona editada" });
        await request(app).put(`/cliente/${cliente.body.data.id}`).set(authUsuario).send({ nombre: "Cliente editado" });

        await request(app).delete('/libro/9789900000108').set(authUsuario);
        await request(app).delete(`/persona/${persona.body.data.id}`).set(authUsuario);
        await request(app).delete(`/cliente/${cliente.body.data.id}`).set(authUsuario);

        const [libroDespues] = await db
            .select({ created_at: librosTable.created_at })
            .from(librosTable)
            .where(eq(librosTable.isbn, "9789900000108"));
        const [personaDespues] = await db
            .select({ created_at: personasTable.created_at })
            .from(personasTable)
            .where(eq(personasTable.id, persona.body.data.id));
        const [clienteDespues] = await db
            .select({ created_at: clientesTable.created_at })
            .from(clientesTable)
            .where(eq(clientesTable.id, cliente.body.data.id));

        expect(libroDespues.created_at?.getTime()).toBe(libroAntes.created_at?.getTime());
        expect(personaDespues.created_at?.getTime()).toBe(personaAntes.created_at?.getTime());
        expect(clienteDespues.created_at?.getTime()).toBe(clienteAntes.created_at?.getTime());
    });

    test('una cuenta con sólo un movimiento de migración tiene 0 operaciones', async () => {
        const usuario = await registrar(107);
        await db.update(usersTable).set({ created_at: haceDias(100) }).where(eq(usersTable.id, usuario.userId));
        await insertarMovimiento(usuario.userId, "ingreso", haceDias(5), true);

        const cuenta = await cuentaDe(adminToken, emailDe(107));
        expect(cuenta.operaciones30d).toBe(0);
        expect(cuenta.ultimaOperacion).toBeNull();
        expect(cuenta.primeraFechaMovimiento).toBeNull();
        expect(cuenta.estado).toBe("inactivo");
    });

    test('las cuentas no confirmadas no aparecen, ni siquiera buscándolas', async () => {
        const res = await request(app).get('/admin/cuentas').query({ q: uNoConfirmadaEmail }).set(auth(adminToken));
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(0);
        expect(res.body.cuentas).toEqual([]);

        const todas = await listarTodas(adminToken);
        expect(todas.items.some((cuenta) => cuenta.email === uNoConfirmadaEmail)).toBe(false);
    });
});

describe('listado, búsqueda, filtros y paginación', () => {
    test('devuelve 10 por página, total correcto y página fuera de rango vacía', async () => {
        const primera = await request(app).get('/admin/cuentas').set(auth(adminToken));
        expect(primera.status).toBe(200);
        expect(primera.body.pagina).toBe(1);
        expect(primera.body.porPagina).toBe(10);
        expect(primera.body.cuentas).toHaveLength(10);
        expect(primera.body.total).toBeGreaterThan(10);

        const fuera = await request(app).get('/admin/cuentas').query({ pagina: 9999 }).set(auth(adminToken));
        expect(fuera.status).toBe(200);
        expect(fuera.body.cuentas).toEqual([]);
        expect(fuera.body.total).toBe(primera.body.total);
    });

    test('busca por razón social/email sin distinguir mayúsculas ni acentos', async () => {
        const porNombre = await request(app)
            .get('/admin/cuentas')
            .query({ q: "pagina 07" })
            .set(auth(adminToken));
        expect(porNombre.status).toBe(200);
        expect(porNombre.body.total).toBe(1);
        expect(porNombre.body.cuentas[0].razonSocial).toBe("Página 07");

        const porEmail = await request(app)
            .get('/admin/cuentas')
            .query({ q: "ADMIN-PANEL-PAGE-05@TEST.COM" })
            .set(auth(adminToken));
        expect(porEmail.status).toBe(200);
        expect(porEmail.body.total).toBe(1);

        const vacia = await request(app)
            .get('/admin/cuentas')
            .query({ q: "no-existe-esta-cuenta" })
            .set(auth(adminToken));
        expect(vacia.status).toBe(200);
        expect(vacia.body.cuentas).toEqual([]);
        expect(vacia.body.total).toBe(0);
    });

    test('filtra por estado y ARCA combinando con AND', async () => {
        const activos = await listarTodas(adminToken, { estado: "activo" });
        expect(activos.items.every((cuenta) => (cuenta.operaciones30d as number) > 0)).toBe(true);

        const inactivos = await listarTodas(adminToken, { estado: "inactivo" });
        expect(inactivos.items.every((cuenta) => (cuenta.operaciones30d as number) === 0)).toBe(true);

        const conArca = await listarTodas(adminToken, { arca: "con" });
        expect(conArca.items.every((cuenta) => cuenta.arcaConectado === true)).toBe(true);

        const sinArca = await listarTodas(adminToken, { arca: "sin" });
        expect(sinArca.items.every((cuenta) => cuenta.arcaConectado === false)).toBe(true);

        const combinados = await listarTodas(adminToken, { estado: "activo", arca: "sin" });
        expect(
            combinados.items.every(
                (cuenta) => (cuenta.operaciones30d as number) > 0 && cuenta.arcaConectado === false
            )
        ).toBe(true);
    });

    test('rechaza parámetros inválidos con el código del contrato', async () => {
        const estado = await request(app).get('/admin/cuentas').query({ estado: "otro" }).set(auth(adminToken));
        expectErrorResponse(estado, 400);
        expect(estado.body.errors[0]).toMatchObject({ code: "invalid_estado", field: "estado" });

        const arca = await request(app).get('/admin/cuentas').query({ arca: "quizas" }).set(auth(adminToken));
        expectErrorResponse(arca, 400);
        expect(arca.body.errors[0]).toMatchObject({ code: "invalid_arca", field: "arca" });

        const pagina = await request(app).get('/admin/cuentas').query({ pagina: "0" }).set(auth(adminToken));
        expectErrorResponse(pagina, 400);
        expect(pagina.body.errors[0]).toMatchObject({ code: "invalid_pagina", field: "pagina" });
    });

    test('el orden es estable por razón social, email e id', async () => {
        const { items } = await listarTodas(adminToken);
        const nombres = items.map((cuenta) => cuenta.razonSocial as string);
        const normalizar = (valor: string) =>
            valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

        const comparar = (a: string, b: string): number => {
            if (normalizar(a) < normalizar(b)) return -1;
            if (normalizar(a) > normalizar(b)) return 1;
            return 0;
        };

        expect(nombres).toEqual([...nombres].sort(comparar));
    });
});

describe('resumen, embudo y serie coherentes', () => {
    test('las cuatro vistas describen el mismo universo', async () => {
        const resumen = await request(app).get('/admin/resumen').set(auth(adminToken));
        expect(resumen.status).toBe(200);

        const embudo = await request(app).get('/admin/embudo').set(auth(adminToken));
        expect(embudo.status).toBe(200);

        const serie = await request(app).get('/admin/serie').set(auth(adminToken));
        expect(serie.status).toBe(200);

        const { items, total } = await listarTodas(adminToken);

        expect(resumen.body.cuentas).toBe(total);
        expect(embudo.body).toEqual({
            cuentas: resumen.body.cuentas,
            conLibro: resumen.body.conLibro,
            conVenta: resumen.body.conVenta
        });
        expect(resumen.body.conLibro).toBe(items.filter((cuenta) => (cuenta.libros as number) > 0).length);
        expect(resumen.body.conVenta).toBe(items.filter((cuenta) => cuenta.ventaHistorica === true).length);
        expect(resumen.body.activas30d).toBe(items.filter((cuenta) => (cuenta.operaciones30d as number) > 0).length);
        expect(resumen.body.activas30d).toBe(items.filter((cuenta) => cuenta.estado === "activo").length);
        expect(resumen.body.arcaConectado).toBe(items.filter((cuenta) => cuenta.arcaConectado === true).length);
        expect(resumen.body.nuevas30d).toBe(
            items.filter(
                (cuenta) =>
                    cuenta.alta !== null &&
                    (cuenta.alta as string) >= resumen.body.periodo.desde &&
                    (cuenta.alta as string) <= resumen.body.periodo.hasta
            ).length
        );

        expect(serie.body.puntos).toHaveLength(6);
        const meses = serie.body.puntos.map((punto: { mes: string }) => punto.mes);
        expect(meses[meses.length - 1]).toBe(mesDeFecha(new Date()));
        for (const punto of serie.body.puntos) {
            expect(punto.mes).toMatch(/^\d{4}-\d{2}$/);
            expect(punto.etapas.soloRegistrado + punto.etapas.cargoLibros + punto.etapas.cargoMovimientos).toBe(punto.total);
        }
        const totales = serie.body.puntos.map((punto: { total: number }) => punto.total);
        expect(totales).toEqual([...totales].sort((a, b) => a - b));
        expect(totales[totales.length - 1]).toBe(resumen.body.cuentas);
    });

    test('el período devuelve fechas YYYY-MM-DD y la ventana de 30 días', async () => {
        const resumen = await request(app).get('/admin/resumen').set(auth(adminToken));
        expect(resumen.body.periodo.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(resumen.body.periodo.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(resumen.body.periodo.hasta).toBe(fechaDeFecha(new Date()));
    });
});

describe('composición mensual por etapa', () => {
    test('acumula la base y ubica cada cuenta en su etapa máxima hasta el cierre', async () => {
        const base = [
            // Aparece desde junio y nunca cargó nada.
            { alta: "2026-06-10", tieneLibro: false, primeraFechaLibro: null, primeraFechaMovimiento: null },
            // Alta en julio y libro posterior: junio no la incluye.
            { alta: "2026-07-01", tieneLibro: true, primeraFechaLibro: "2026-07-05", primeraFechaMovimiento: null },
            // Libro anterior al alta (se usa el alta) y movimiento en septiembre.
            { alta: "2026-08-01", tieneLibro: true, primeraFechaLibro: "2026-06-01", primeraFechaMovimiento: "2026-09-10" },
            // Alta desconocida y libro sin fecha: entra desde el primer mes con
            // la cota inferior y queda en "cargó libros".
            { alta: null, tieneLibro: true, primeraFechaLibro: null, primeraFechaMovimiento: null },
            // Movimiento anterior a la ventana: está en movimientos todo el tramo.
            { alta: "2026-05-01", tieneLibro: false, primeraFechaLibro: null, primeraFechaMovimiento: "2026-05-15" }
        ];
        const service = createAdminService({
            repository: { baseSerie: async () => base } as unknown as AdminRepository,
            ahora: () => new Date("2026-11-15T12:00:00Z")
        });

        const { puntos } = await service.serie();

        expect(puntos.map((punto) => punto.mes)).toEqual([
            "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"
        ]);
        expect(puntos.map((punto) => punto.total)).toEqual([3, 4, 5, 5, 5, 5]);
        expect(puntos.map((punto) => punto.etapas)).toEqual([
            { soloRegistrado: 1, cargoLibros: 1, cargoMovimientos: 1 },
            { soloRegistrado: 1, cargoLibros: 2, cargoMovimientos: 1 },
            { soloRegistrado: 1, cargoLibros: 3, cargoMovimientos: 1 },
            { soloRegistrado: 1, cargoLibros: 2, cargoMovimientos: 2 },
            { soloRegistrado: 1, cargoLibros: 2, cargoMovimientos: 2 },
            { soloRegistrado: 1, cargoLibros: 2, cargoMovimientos: 2 }
        ]);
    });
});
