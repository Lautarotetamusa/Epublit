import {expect} from 'vitest';
import { Response } from 'supertest';

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
