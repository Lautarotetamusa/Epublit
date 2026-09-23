import { afipSchema } from './afip.validator';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { createPkSchema } from 'bradb';
import { usersTable } from '../schemas/users.schema';
import {z} from 'zod';

// Validators nuevos (Postgres/Drizzle), usados por user.controller.ts/user.service.ts.
// `select` excluye siempre `password`: estructuralmente imposible devolver el
// hash en una respuesta, sin depender de que cada controller se acuerde de omitirlo.
const select = createSelectSchema(usersTable).omit({ password: true });
const insert = createInsertSchema(usersTable);
// `email`/`punto_venta` se redeclaran explícitos (no delegados a las columnas
// de Drizzle, que son nullable/sin restricción) para poder rechazar email
// vacío y punto_venta negativo, igual que el `updateUser` viejo.
const update = z.object({
    email: z.string().min(1),
    punto_venta: z.number().gte(0)
}).partial();
const pk = createPkSchema(usersTable);

export type UserInsert = z.infer<typeof insert>;
export type UserUpdate = z.infer<typeof update>;
export type User = z.infer<typeof select>;

export const userValidator = {
    select,
    insert,
    update,
    pk
};

export const loginUserValidator = z.object({
    username: z.string(),
    password: z.string(),
});

export const createUserValidator = insert.pick({
    username: true,
    password: true,
    cuit: true,
    email: true,
});
export type CreateUserInput = z.infer<typeof createUserValidator>;

// Validator viejo, todavía usado sólo por `middleware/auth.ts` (`TokenUser`):
// `models/user.model.ts` (mysql2) se borró en la migración de
// `transaccion`/`venta` (005), su único consumidor real. Se da de baja este
// bloque cuando `auth.ts` migre a `TokenUser` basado en `userValidator.select`.
const baseSchema = z.object({
    id: z.number(),
    username: z.string(),
    password: z.string(),
    cuit: z.string(),
    email: z.string().email(),
    production: z.number(),
    punto_venta: z.number().gte(0).nullable()
});

const userSchema = baseSchema.and(afipSchema);
type UserSchema = z.infer<typeof userSchema>;

export type TokenUser = Pick<UserSchema, 'id' | 'cuit'>
