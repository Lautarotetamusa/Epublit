import {expect, it} from '@jest/globals';

import { getAfipData } from "../src/afip/Afip";
import { AfipData } from '../src/schemas/afip.schema';

type Expecteds = {[key: string]: AfipData}

const expecteds: Expecteds = {
    "27249804024": {
        domicilio: "URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE - SANTA FE",
        razon_social: "MARIA CAROLINA MUSA",
        cond_fiscal: "IVA EXENTO",
        ingresos_brutos: true,
        fecha_inicio: "01/01/2021"
    },
    "20434919798": {
        domicilio: "URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE - SANTA FE",
        razon_social: "LAUTARO TETA MUSA",
        cond_fiscal: " - ",
        ingresos_brutos: false,
        fecha_inicio: "01/10/2021"
    },
    "30709354082": {
        domicilio: " - ",
        razon_social: "EL GRAN HERMANO",
        cond_fiscal: " - ",
        ingresos_brutos: false,
        fecha_inicio: " - "
    },
    "30712472053": {
        domicilio: "ESPINOSA 1581 - CIUDAD AUTONOMA BUENOS AIRES",
        razon_social: "LIBROS PARA VER MUNDOS S.R.L.",
        cond_fiscal: "IVA EXENTO",
        ingresos_brutos: false,
        fecha_inicio: "01/11/2013"
    },
}

//Correr todos los tests en paralelo
for (const cuit in expecteds){
    it(`Obtener datos cliente ${cuit}`, async () => {
        const data = await getAfipData(cuit);
        expect(data).toEqual(expecteds[cuit]);
    }, 10000);
}
