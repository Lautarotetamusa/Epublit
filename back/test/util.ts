import {expect} from 'vitest';
import request, { Response } from 'supertest';
import type { Express } from 'express';

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
 
