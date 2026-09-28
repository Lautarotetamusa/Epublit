import { eq } from "drizzle-orm";
import { ServiceBuilder } from "bradb";
import { Database, Tx } from "../../db/client";
import { usersTable } from "./user.schema";
import { clientesTable } from "../cliente/cliente.schema";
import { userFilterMap } from "./user.filter";
import { userValidator, UserInsert, User } from "./user.validator";
import { NotFound } from "bradb";

export type UserRepositoryDeps = {
    db: Database;
};

export function createUserRepository({ db }: UserRepositoryDeps) {
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
                punto_venta: usersTable.punto_venta,
                foto_persona_max_size_mb: usersTable.foto_persona_max_size_mb,
                foto_persona_min_ancho_px: usersTable.foto_persona_min_ancho_px,
                foto_persona_min_alto_px: usersTable.foto_persona_min_alto_px
            })
            .from(usersTable)
            .$dynamic();

    const findOne = builder.findOne(selectWithoutPassword);
    // `persistUpdate` (crudo, bradb) en vez de `userValidator.select.parse`:
    // ese parse se hace a mano en cada método público del service, así el
    // password nunca sale de este archivo.
    const persistUpdate = builder.update();
    // No es un reenvío ciego (aunque el linter lo lea así): documenta la
    // regla de seguridad de no filtrar el password y fija el tipo `User`.
    // eslint-disable-next-line local/no-redundant-wrapper
    const stripPassword = (row: typeof usersTable.$inferSelect): User => userValidator.select.parse(row);

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

    const insertUser = async (data: UserInsert, tx?: Tx) => {
        const [user] = await (tx ?? db).insert(usersTable).values(data).returning();
        return user;
    };

    // Ver `db/migrations/auto_client_inserts.sql` (trigger MySQL que
    // reemplaza este insert para usuarios nuevos, que ya no pasan por MySQL).
    const insertDefaultClientes = async (userId: number, tx?: Tx) => {
        await (tx ?? db).insert(clientesTable).values([
            {
                nombre: "CONSUMIDOR FINAL",
                tipo: "particular",
                cond_fiscal: "CONSUMIDOR FINAL",
                razon_social: "CONSUMIDOR FINAL",
                domicilio: "",
                user: userId
            },
            {
                nombre: "MOSTRADOR",
                tipo: "negro",
                cond_fiscal: "",
                razon_social: "",
                domicilio: "",
                user: userId
            }
        ]);
    };

    const removeUser = async (id: number, tx?: Tx) => {
        await (tx ?? db).delete(usersTable).where(eq(usersTable.id, id));
    };

    // Los clientes se borran primero porque `clientes.user` referencia
    // `users.id` sin `onDelete: cascade`: eso lo decide quien orqueste la
    // transacción (el service), no este método.
    const removeDefaultClientes = async (userId: number, tx?: Tx) => {
        await (tx ?? db).delete(clientesTable).where(eq(clientesTable.user, userId));
    };

    return {
        findOne,
        persistUpdate,
        stripPassword,
        existsByUsername,
        existsByCuit,
        getPasswordHash,
        findByUsername,
        insertUser,
        insertDefaultClientes,
        removeUser,
        removeDefaultClientes
    };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
