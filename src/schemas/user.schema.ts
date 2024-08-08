import { afipSchema } from './afip.schema';
import {z} from 'zod';

const baseSchema = z.object({
    id: z.number(),
    username: z.string(),
    password: z.string(),
    cuit: z.string(),
    email: z.string().email(),
    production: z.number()
});

const userSchema = baseSchema.and(afipSchema);
export type UserSchema = z.infer<typeof userSchema>; 

export const loginUser = z.object({
    username: z.string(),
    password: z.string(),
});

export type TokenUser = Omit<UserSchema, 'email' | 'password'> 

export type UpdateUser = Partial<Omit<UserSchema, 'cuit' | 'id'>>;

export const createUser = baseSchema.pick({ 
    username: true,
    password: true,
    cuit: true,
    email: true,
});
export type CreateUser = z.infer<typeof createUser>;

export type SaveUser = Omit<UserSchema, 'id'>;
