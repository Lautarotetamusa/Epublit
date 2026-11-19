import { afipSchema } from '../../lib/afip/afip.validator';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { createPkSchema } from 'bradb';
import { usersTable } from './user.schema';
import {z} from 'zod';
import { isValidCuit } from '../../lib/cuit';

export const PASSWORD_MIN_LENGTH = 8;

// Se compara y se guarda siempre así: el índice único del email no distingue
// mayúsculas y el login por email tampoco.
export const normalizarEmail = (email: string): string => email.trim().toLowerCase();

const emailValido = z.string().transform(normalizarEmail).pipe(z.email());
const passwordNueva = z.string().min(PASSWORD_MIN_LENGTH);
// Se acepta pegado con guiones, espacios o puntos, como lo muestra ARCA.
const cuitValido = z
    .string()
    .transform((cuit) => cuit.replace(/[\s.-]/g, ""))
    .refine(isValidCuit);

// Validators nuevos (Postgres/Drizzle), usados por user.controller.ts/user.service.ts.
// `select` excluye siempre `password`: estructuralmente imposible devolver el
// hash en una respuesta, sin depender de que cada controller se acuerde de omitirlo.
const select = createSelectSchema(usersTable).omit({ password: true });
const insert = createInsertSchema(usersTable);
// `email`/`punto_venta` se redeclaran explícitos (no delegados a las columnas
// de Drizzle, que son nullable/sin restricción) para poder rechazar email
// vacío y punto_venta negativo, igual que el `updateUser` viejo.
// Las tres restricciones de foto de persona (specs/004-persona-foto-bio) son
// `.nullable()` además de `.optional()`: mandar el campo en `null` es cómo
// el usuario vuelve a dejarlo "sin límite", a diferencia de omitirlo (que
// deja el valor previo intacto).
const update = z.object({
    email: z.string().transform(normalizarEmail).pipe(z.string().min(1)),
    punto_venta: z.number().gte(0),
    // Datos fiscales del emisor (ver specs/019-ajustes-liquidaciones-fiscales-edad): antes sólo
    // se podían cambiar por el padrón de AFIP (`PUT /user/afip`), así que una
    // condición desactualizada en producción no se podía corregir a mano.
    cond_fiscal: z.string().trim().min(1).max(50),
    razon_social: z.string().trim().min(1).max(255),
    domicilio: z.string().trim().min(1).max(100),
    ingresos_brutos: z.boolean(),
    // Formato dd/mm/aaaa del padrón; se acepta cualquier string corto para no
    // bloquear cuentas que hoy tienen " - ".
    fecha_inicio: z.string().trim().max(10),
    foto_persona_max_size_mb: z.number().positive().nullable(),
    foto_persona_min_ancho_px: z.number().int().positive().nullable(),
    foto_persona_min_alto_px: z.number().int().positive().nullable()
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

// `identifier` es un email o un username: con `@` se busca por email
// normalizado, sin `@` por username exacto (ver user.acceso.service.ts).
export const loginUserValidator = z.object({
    identifier: z.string(),
    password: z.string(),
});

export const registroValidator = z.object({
    email: emailValido,
    password: passwordNueva,
    cuit: cuitValido
});
export type RegistroInput = z.infer<typeof registroValidator>;

export const emailValidator = z.object({ email: emailValido });

// Un token vacío o ausente es un link inválido (404), no un 400: el front
// muestra lo mismo en los dos casos.
const tokenOpcional = z.string().catch("");

export const tokenValidator = z.object({ token: tokenOpcional });

export const restablecerContrasenaValidator = z.object({
    password: passwordNueva,
    token: tokenOpcional
});

// Validator viejo, todavía usado sólo por `lib/auth/auth.ts` (`TokenUser`):
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
