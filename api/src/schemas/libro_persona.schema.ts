import {z} from 'zod';
import { ValidationError } from '../models/errors';
import { createPersona } from './persona.schema'
import { validate } from './validate'

export const tipoPersona = {
    "autor": 0,
    "ilustrador": 1
}  as const;
export type TipoPersona = keyof typeof tipoPersona;
const tipoPersonaKeys = Object.keys(tipoPersona) as [TipoPersona];

export const libroPersonaSchema = z.object({
    porcentaje: z.number().min(0).max(100),
    tipo: z.enum(tipoPersonaKeys),
    isbn: z.string(),
    id_persona: z.number()
});
export type LibroPersonaSchema = z.infer<typeof libroPersonaSchema>;

const libroPersonaKey = libroPersonaSchema.omit({
    porcentaje: true
});
export type LibroPersonaKey = z.infer<typeof libroPersonaKey>;

const updateLibroPersona = libroPersonaSchema.pick({
    porcentaje: true
});
type UpdateLibroPersona = z.infer<typeof updateLibroPersona>;

export const createLibroPersona = createPersona.and(libroPersonaSchema.omit({
    id_persona: true
}));
export type CreateLibroPersona = z.infer<typeof createLibroPersona>;

export class validateLibroPersona{
    static tipoPersona(tipo: any): tipo is TipoPersona{
        return Object.values(tipoPersona).includes(tipo);
    }

    static indb(obj: any): CreatePersonaLibroInDB{
        const required = {
            'porcentaje': 'number',
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<CreatePersonaLibroInDB>(required, obj);

        if(!validateLibroPersona.tipoPersona(valid.tipo))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(tipoPersona)}`);

        return valid;
    }

    static not_in_db(obj: any): createPersonaLibroNOTInDB{
        const required = {
            'porcentaje': 'number',
            'tipo': 'ignore',
            'isbn': 'string',
            'nombre': 'ignore',
            'email': 'ignore',
            'dni': 'ignore'
        }
        let valid = validate<createPersonaLibroNOTInDB>(required, obj);

        if(!validateLibroPersona.tipoPersona(valid.tipo))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(tipoPersona)}`);
        
        let valid_p = createPersona.parse(valid);

        return Object.assign({}, valid, valid_p);
    }

    static create(obj: any): createPersonaLibro{
        if ("id" in obj){
            return validateLibroPersona.indb(obj);
        }else{
            return validateLibroPersona.not_in_db(obj);
        }
    }

    static update(obj: unknown): UpdateLibroPersona{
        const required = {
            'porcentaje': 'number',
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<UpdateLibroPersona>(required, obj);

        if(!validateLibroPersona.tipoPersona(valid.tipo))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(tipoPersona)}`);

        return valid;
    }

    static all<T>(obj: unknown[], validator: Function): T[]{
        let valid_objs: T[] = [];
        for (let o of obj)
            valid_objs.push(validator(o));
            
        return valid_objs;
    }

    static remove(obj: unknown): removePersonaLibro{
        const required = {
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<removePersonaLibro>(required, obj);

        if(!validateLibroPersona.tipoPersona(valid.tipo))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(tipoPersona)}`);

        return valid;
    }
}
