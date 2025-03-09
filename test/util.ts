import {expect} from '@jest/globals';
import { Response } from 'supertest';

export function expectNotFound(res: Response){
    expectErrorResponse(res, 404);
}

export function expectBadRequest(res: Response){
    expectErrorResponse(res, 400);
}

export function expectCreated(res: Response){
    expectDataResponse(res, 201);
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
