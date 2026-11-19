import {expect} from 'vitest';
import request, { Response } from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { usersTable } from '../src/db/schema';

export function expectNotFound(res: Response){
    expectErrorResponse(res, 404);
}

export function expectBadRequest(res: Response){
    expectErrorResponse(res, 400);
}

export function expectConflict(res: Response){
    expectErrorResponse(res, 409);
}

export function expectCreated(res: Response){
    expectDataResponse(res, 201);
}

export function expectUpdated(res: Response){
    expectDataResponse(res, 200);
}

export function expectList(res: Response){
    if (res.status != 200){
        console.error(res.body);
    }

    expect(res.status).toEqual(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
}

export function expectErrorResponse(res: Response, status: number){
    if (status != res.status){
        console.error(res.body);
    }

    expect(res.status).toEqual(status);
    expect(res.body.success).toEqual(false);
    expect(res.body.errors).toBeDefined();
    expect(res.body.data).not.toBeDefined();
}

export function expectDataResponse(res: Response, status: number){
    if (status != res.status){
        console.error(res.body);
    }

    expect(res.status).toEqual(status);
    expect(res.body.success).toEqual(true);
    expect(res.body.errors).not.toBeDefined();
    expect(res.body.data).toBeDefined();
}

export function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

// El stock ya no se setea en el alta del libro: se carga con un movimiento de
// ingreso (`exterior` → depósito principal) para los tests que necesitan
// saldo. Devuelve la respuesta del POST por si el test quiere inspeccionarla.
export function cargarStockPrincipal(app: Express, token: string, isbnLibro: string, cantidad: number) {
    const auth = { Authorization: `Bearer ${token}` };

    return request(app)
        .get('/deposito/')
        .set(auth)
        .then((depositos) => {
            const principal = depositos.body.data.find((d: { principal: boolean }) => d.principal);

            return request(app)
                .post('/movimiento/')
                .set(auth)
                .send({
                    origen: { tipo: 'exterior' },
                    destino: { tipo: 'deposito', id: principal.id },
                    libros: [{ isbn: isbnLibro, cantidad }]
                });
        });
}

// Id del medio de pago de la cuenta (los 5 por defecto se crean al registrar
// el usuario): los tests venden por id, no por nombre.
export async function getMedioPagoId(app: Express, token: string, nombre: string): Promise<number> {
    const res = await request(app).get('/venta/medios_pago').set({ Authorization: `Bearer ${token}` });
    const medio = res.body.find((m: { nombre: string }) => m.nombre === nombre);

    return medio.id;
}

// Id del rol de la cuenta (autor/ilustrador se crean al registrar el usuario):
// los tests de libro↔persona, personas y liquidación referencian el rol por id.
export async function getRolId(app: Express, token: string, nombre: string): Promise<number> {
    const res = await request(app).get('/rol').set({ Authorization: `Bearer ${token}` });
    const rol = res.body.find((r: { nombre: string }) => r.nombre === nombre);

    return rol.id;
}
 

// Misma normalización que `ordenAlfabetico` (src/lib/sql/search.ts): sin
// acentos y en minúsculas.
const sinAcentos = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function expectOrdenAlfabetico(valores: string[]) {
    const ordenados = [...valores].sort((a, b) => (sinAcentos(a) < sinAcentos(b) ? -1 : sinAcentos(a) > sinAcentos(b) ? 1 : 0));
    expect(valores).toEqual(ordenados);
}

export type DatosDeRegistro = { email: string; password: string; cuit: string };

// Las cuentas nuevas no entran hasta confirmar el email (ver
// specs/026-registro-email): los tests que sólo necesitan una cuenta nueva
// la confirman directo en la base en vez de seguir el link del mail.
export async function registrarCuentaConfirmada(app: Express, datos: DatosDeRegistro): Promise<{ token: string; userId: number }> {
    const alta = await request(app).post('/user/register').send(datos);
    expectCreated(alta);

    const [user] = await db
        .update(usersTable)
        .set({ email_confirmado: true })
        .where(eq(usersTable.email, alta.body.data.email))
        .returning({ id: usersTable.id });
    const login = await request(app).post('/user/login').send({ identifier: datos.email, password: datos.password });
    expect(login.status).toBe(200);

    return { token: login.body.token, userId: user.id };
}
