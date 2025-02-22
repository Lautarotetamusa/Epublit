// TODO:
// mockear las respuestas del servidor para muchos cuits
// para cada cuit testear que parsee la data correctamente


//import {expect, test} from '@jest/globals';
//
//import { getAfipData, getServerStatus } from "../src/afip/Afip";
//import { AfipData } from '../src/schemas/afip.schema';
//import { User } from '../src/models/user.model';
//
//type Expecteds = {[key: string]: AfipData}
//
//const expecteds: Expecteds = {
//    "27249804024": {
//        domicilio: "URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE - SANTA FE",
//        razon_social: "MARIA CAROLINA MUSA",
//        cond_fiscal: "IVA EXENTO",
//        ingresos_brutos: true,
//        fecha_inicio: "01/01/2021"
//    },
//    "20434919798": {
//        domicilio: "URQUIZA 1159 Piso:4 Dpto:4 - ROSARIO NORTE - SANTA FE",
//        razon_social: "LAUTARO TETA MUSA",
//        cond_fiscal: " - ",
//        ingresos_brutos: false,
//        fecha_inicio: "01/10/2021"
//    },
//    "30709354082": {
//        domicilio: " - ",
//        razon_social: "EL GRAN HERMANO",
//        cond_fiscal: " - ",
//        ingresos_brutos: false,
//        fecha_inicio: " - "
//    },
//    "30712472053": {
//        domicilio: "ESPINOSA 1581 - CIUDAD AUTONOMA BUENOS AIRES",
//        razon_social: "LIBROS PARA VER MUNDOS S.R.L.",
//        cond_fiscal: "IVA EXENTO",
//        ingresos_brutos: false,
//        fecha_inicio: "01/11/2013"
//    },
//}
//
////Correr todos los tests en paralelo
//for (const cuit in expecteds){
//    test(`Obtener datos cliente ${cuit}`, async () => {
//        const data = await getAfipData(cuit);
//        expect(data).toEqual(expecteds[cuit]);
//    }, 10000);
//}
//
//test(`Estado del servidor`, async () => {
//    const user = await User.getOne("teti");
//    const status = await getServerStatus(user);
//
//    expect(status).toHaveProperty("AppServer");
//    expect(status.AppServer).toBe("OK");
//
//    expect(status).toHaveProperty("DbServer");
//    expect(status.DbServer).toBe("OK");
//
//    expect(status).toHaveProperty("AuthServer");
//    expect(status.AuthServer).toBe("OK");
//}, 10000);
