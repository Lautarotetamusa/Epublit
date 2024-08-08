import {describe, expect, test} from '@jest/globals';

import * as dotenv from 'dotenv';
import { join } from "path";

const path = join(__dirname, "../.env");
dotenv.config({path: path});

const app = `${process.env.PROTOCOL}://${process.env.SERVER_HOST}:${process.env.BACK_PUBLIC_PORT}`;
console.log(app);

let glob = 0;
//LO hizo secuencial

test("test 1", async() => {
    await delay(3000);    
    glob = 9;
    expect(1).toBe(1);
});
test("test 2", async() => {
    expect(glob).toBe(9);
});

export function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
} 
