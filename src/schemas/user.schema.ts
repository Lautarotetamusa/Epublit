import { afipSchema } from './afip.schema';
import {z} from 'zod';

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
export type UserSchema = z.infer<typeof userSchema>; 

export const updateUser = baseSchema.pick({
    email: true,
    punto_venta: true,
}).partial()

export const loginUser = z.object({
    username: z.string(),
    password: z.string(),
});

export type TokenUser = Pick<UserSchema, 'id' | 'cuit'> 

// used to update the afip data, get all the information again from afip webservice
export type UpdateAfipUser = Partial<z.infer<typeof afipSchema>>;

export type UpdateUser = z.infer<typeof updateUser>;

export const createUser = baseSchema.pick({ 
    username: true,
    password: true,
    cuit: true,
    email: true,
});
export type CreateUser = z.infer<typeof createUser>;

export type SaveUser = Omit<UserSchema, 'id' | 'punto_venta'>;
