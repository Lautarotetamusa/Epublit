import { eq } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { db } from "../pgDb";
import { usersTable } from "../schemas/users.schema";
import { clientesTable } from "../schemas/clientes.schema";
import { userFilterMap } from "../filters/user.filter";
import { UserInsert, UserUpdate, User } from "../validators/user.validator";
import { AfipData } from "../validators/afip.validator";
import { NotFound } from "../models/errors";

const builder = new ServiceBuilder(db, usersTable, userFilterMap);

// Columnas de `usersTable` sin `password`: se reutiliza acá y en
// `findByUsername` para que sea imposible traer el hash por accidente en
// ningún camino de lectura, ni siquiera si se agrega un campo nuevo a mano.
const selectWithoutPassword = () =>
    db
        .select({
            id: usersTable.id,
            username: usersTable.username,
            cuit: usersTable.cuit,
            cond_fiscal: usersTable.cond_fiscal,
            razon_social: usersTable.razon_social,
            domicilio: usersTable.domicilio,
            production: usersTable.production,
            email: usersTable.email,
            ingresos_brutos: usersTable.ingresos_brutos,
            fecha_inicio: usersTable.fecha_inicio,
            punto_venta: usersTable.punto_venta
        })
        .from(usersTable)
        .$dynamic();

const findOne = builder.findOne(selectWithoutPassword);
// Sin `select` custom: bradb no permite combinarlo con hooks fácilmente. El
// controller es responsable de pasar el resultado por
// `userValidator.select.parse(...)` antes de responder, para no filtrar
// `password` (ver user.controller.ts).
const update = builder.update();

const existsByUsername = async (username: string): Promise<boolean> => {
    const rows = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, username))
        .limit(1);

    return rows.length > 0;
};

const existsByCuit = async (cuit: string): Promise<boolean> => {
    const rows = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.cuit, cuit))
        .limit(1);

    return rows.length > 0;
};

const getPasswordHash = async (id: number): Promise<string> => {
    const rows = await db
        .select({ password: usersTable.password })
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);

    if (rows.length === 0) throw new NotFound(`No existe un usuario con id ${id}`);

    return rows[0].password;
};

const findByUsername = async (username: string): Promise<User> => {
    const rows = await selectWithoutPassword().where(eq(usersTable.username, username));

    if (rows.length === 0) throw new NotFound(`No existe un usuario con username ${username}`);

    return rows[0];
};

// Alta completa del usuario y sus clientes por defecto (MOSTRADOR,
// CONSUMIDOR FINAL) en una única transacción Postgres: ver
// `db/migrations/auto_client_inserts.sql` (trigger MySQL que reemplaza este
// insert para usuarios nuevos, que ya no pasan por MySQL). Los pasos de
// filesystem/AFIP (clave, CSR) quedan en el controller, que revierte esta
// transacción si fallan.
const createUser = async (data: UserInsert): Promise<User> => {
    return db.transaction(async (tx) => {
        const [user] = await tx.insert(usersTable).values(data).returning();

        await tx.insert(clientesTable).values([
            {
                nombre: "CONSUMIDOR FINAL",
                tipo: "particular",
                cond_fiscal: "CONSUMIDOR FINAL",
                razon_social: "CONSUMIDOR FINAL",
                domicilio: "",
                user: user.id
            },
            {
                nombre: "MOSTRADOR",
                tipo: "negro",
                cond_fiscal: "",
                razon_social: "",
                domicilio: "",
                user: user.id
            }
        ]);

        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    });
};

const updateAfipData = async (id: number, afipData: AfipData): Promise<User> => {
    const updated = await update({ id }, afipData);
    const { password, ...userWithoutPassword } = updated;
    return userWithoutPassword;
};

// Compensación del alta (T9): borra el usuario y sus clientes por defecto si
// falla algún paso de filesystem/AFIP posterior a `createUser`. Los clientes
// se borran primero porque `clientes.user` referencia `users.id` sin
// `onDelete: cascade`.
const remove = async (pk: { id: number }): Promise<void> => {
    await db.transaction(async (tx) => {
        await tx.delete(clientesTable).where(eq(clientesTable.user, pk.id));
        await tx.delete(usersTable).where(eq(usersTable.id, pk.id));
    });
};

export const userService = {
    findOne,
    update,
    existsByUsername,
    existsByCuit,
    getPasswordHash,
    findByUsername,
    createUser,
    updateAfipData,
    remove
};
