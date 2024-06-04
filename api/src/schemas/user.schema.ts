import { afipSchema } from './cliente.schema';
import {z} from 'zod';

const userSchema = z.object({
    id: z.number(),
    username: z.string(),
    password: z.string(),
    cuit: z.string(),
    production: z.boolean()
}).and(afipSchema);
export type UserSchema = z.infer<typeof userSchema>; 

export const loginUser = z.object({
    username: z.string(),
    password: z.string(),
});

export type UpdateUser = Partial<Omit<UserSchema, 'cuit' | 'id'>>;

export const createUser = z.object({
    username: z.string(),
    password: z.string(),
    cuit: z.string()
});
export type CreateUser = z.infer<typeof createUser>;

export type SaveUser = Omit<UserSchema, 'id'>;
