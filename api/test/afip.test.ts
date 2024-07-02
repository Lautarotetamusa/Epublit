import {expect, it} from '@jest/globals';

import { getAfipData } from "../src/afip/Afip";

type Expecteds = {[key: string]: {
    domicilio: string,
    razon_social: string,
    cond_fiscal: string
}}

const expecteds: Expecteds = {
    "27249804024": {
        domicilio: "URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE",
        razon_social: "MARIA CAROLINA MUSA",
        cond_fiscal: "IVA EXENTO"
    },
    "20434919798": {
        domicilio: "URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE",
        razon_social: "LAUTARO TETA MUSA",
        cond_fiscal: " - "
    },
    "30709354082": {
        domicilio: " - ",
        razon_social: "EL GRAN HERMANO",
        cond_fiscal: " - "
    },
}

it('Obtener datos cliente', async () => {
    for (const cuit in expecteds){
        const data = await getAfipData(cuit);
        
        expect(data).toEqual(expecteds[cuit]);
    }
}, 40000);
