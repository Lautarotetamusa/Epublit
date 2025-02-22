import {expect} from '@jest/globals';

export function expect_err_code(code: number, res: any){
    if (code != res.status){
        console.error(res.body);
    }

    expect(res.status).toEqual(code);
    expect(res.body.success).toEqual(false);
    expect(res.body.errors).toBeDefined();
}

export function expect_success_code(code: number, res: any){
    if (code != res.status){
        console.error(res.body);
    }

    expect(res.status).toEqual(code);
    expect(res.body.success).toEqual(true);
    expect(res.body.errors).not.toBeDefined();
}

export function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
} 
