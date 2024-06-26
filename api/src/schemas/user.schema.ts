import { afipSchema } from './cliente.schema';
import {z} from 'zod';

const userSchema = z.object({
    id: z.number(),
    username: z.string(),
    password: z.string(),
    cuit: z.string(),
    email: z.string().email(),
    production: z.number()
}).and(afipSchema);
export type UserSchema = z.infer<typeof userSchema>; 

export const loginUser = z.object({
    username: z.string(),
    password: z.string(),
});

export type TokenUser = Omit<UserSchema, 'email' | 'password'> 

export type UpdateUser = Partial<Omit<UserSchema, 'cuit' | 'id'>>;

export const createUser = z.object({ //No ponemos pick porque no existe en el objecto zod.intersection
    username: z.string(),
    password: z.string(),
    cuit: z.string(),
    email: z.string().email()
});
export type CreateUser = z.infer<typeof createUser>;

export type SaveUser = Omit<UserSchema, 'id'>;
