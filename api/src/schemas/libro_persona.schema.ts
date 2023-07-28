import { ValidationError } from '../models/errors';
import { createPersona,  validatePersona } from './persona.schema'
import { validate } from './validate'

export enum TipoPersona {
    autor = 0,
    ilustrador
}
export type TipoPersonaString = keyof typeof TipoPersona;

export type LibroPersonaPK = {
    tipo: TipoPersona;
    id: number;
    isbn: string;
}

export interface createPersonaLibroInDB extends LibroPersonaPK{
    porcentaje: number;
}
export interface createPersonaLibroNOTInDB extends createPersona{
    porcentaje: number;
    tipo: TipoPersona;
    isbn: string;
}
export type createPersonaLibro = createPersonaLibroInDB | createPersonaLibroNOTInDB;

export interface retrieveLibroPersona extends createPersonaLibroInDB{
    dni: string,
    nombre: string,
    email: string,
};

export interface removePersonaLibro extends LibroPersonaPK{};

export interface updateLibroPersona extends createPersonaLibroInDB{};

export class validateLibroPersona{
    static tipoPersona(tipo: any): tipo is TipoPersona{
        return Object.values(TipoPersona).includes(tipo);
    }

    static indb(obj: any): createPersonaLibroInDB{
        const required = {
            'porcentaje': 'number',
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<createPersonaLibroInDB>(required, obj);

        if(!validateLibroPersona.tipoPersona(valid.tipo))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(TipoPersona)}`);

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
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(TipoPersona)}`);
        
        let valid_p = validatePersona.create(Object.assign({}, valid));

        return Object.assign({}, valid, valid_p);
    }

    static create(obj: any): createPersonaLibro{
        if ("id" in obj){
            return validateLibroPersona.indb(obj);
        }else{
            return validateLibroPersona.not_in_db(obj);
        }
    }

    static update(obj: unknown): updateLibroPersona{
        const required = {
            'porcentaje': 'number',
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<updateLibroPersona>(required, obj);

        if(!validateLibroPersona.tipoPersona(valid.tipo))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(TipoPersona)}`);

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
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(TipoPersona)}`);

        return valid;
    }
}