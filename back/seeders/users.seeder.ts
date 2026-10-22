import bcrypt from "bcrypt";
import { UserInsert, UserService } from "../src/modules/user";
import { domicilio, cuit, email } from "./data";

// Usuarios de prueba fijos (no generados por índice como el resto de las
// entidades): son la puerta de entrada para loguearse a mano en desarrollo,
// así que conviene que su username/password sean previsibles.
const USUARIOS_SEED: Omit<UserInsert, "password">[] = [
    {
        username: "libreria_sur",
        cuit: cuit(1),
        cond_fiscal: "RESPONSABLE INSCRIPTO",
        razon_social: "Librería Sur SRL",
        domicilio: domicilio(1, "San Martín"),
        email: email("libreria_sur", 1),
        production: false,
        ingresos_brutos: false,
        fecha_inicio: "01/01/2020",
        punto_venta: 1
    },
    {
        username: "editorial_norte",
        cuit: cuit(2),
        cond_fiscal: "RESPONSABLE INSCRIPTO",
        razon_social: "Editorial Norte SA",
        domicilio: domicilio(2, "Belgrano"),
        email: email("editorial_norte", 2),
        production: false,
        ingresos_brutos: true,
        fecha_inicio: "15/03/2019",
        punto_venta: 2
    }
];

export const PASSWORD_SEED = "seed12345";

export type SeedUser = Awaited<ReturnType<UserService["createUser"]>>;

// `createUser` (no un insert directo) porque crea también los clientes por
// defecto (MOSTRADOR/CONSUMIDOR FINAL) dentro de la misma transacción: ver
// user.service.ts. Duplicar esa lógica acá violaría DRY. `userService` entra
// por parámetro, mismo patrón que el resto de los seeders.
export async function seedUsers(userService: UserService): Promise<SeedUser[]> {
    const password = await bcrypt.hash(PASSWORD_SEED, 10);

    const users: SeedUser[] = [];
    for (const usuario of USUARIOS_SEED) {
        users.push(await userService.createUser({ ...usuario, password }));
    }
    return users;
}
