import { ValidationError } from '../models/errors';
import { createPersona,  validatePersona } from './persona.schema'
import { retrieve, validate } from './validate'

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

export interface retrieveLibroPersona extends createPersonaLibroInDB{};

export interface removePersonaLibro extends LibroPersonaPK{};

export interface updateLibroPersona extends createPersonaLibroInDB{};

export class validateLibroPersona{
    static tipoPersona(tipo: any): tipo is TipoPersona{
        return Object.values(TipoPersona).includes(tipo);
    }

    static indb(obj: any): retrieve<createPersonaLibroInDB>{
        const required = {
            'porcentaje': 'number',
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<createPersonaLibroInDB>(required, obj);
        if (valid.error !== null)
            return valid

        if(!validateLibroPersona.tipoPersona(valid.obj.tipo))
            return {error: `El tipo pasado no es correcto ${Object.keys(TipoPersona)}`, obj: null}

        return {error: null, obj: valid.obj}
    }

    static not_in_db(obj: any): retrieve<createPersonaLibroNOTInDB>{
        const required = {
            'porcentaje': 'number',
            'tipo': 'ignore',
            'isbn': 'string',
            'nombre': 'ignore',
            'email': 'ignore',
            'dni': 'ignore'
        }
        let valid = validate<createPersonaLibroNOTInDB>(required, obj);
        if (valid.error !== null)
            return valid

        if(!validateLibroPersona.tipoPersona(valid.obj.tipo))
            return {error: `El tipo pasado no es correcto ${Object.keys(TipoPersona)}`, obj: null}
        
        let valid_p = validatePersona.create(Object.assign({}, valid.obj));
        if (valid_p.error !== null)
            return valid_p
        
        return {error: null, obj: Object.assign({}, valid.obj, valid_p.obj)}
    }

    static create(obj: any): retrieve<createPersonaLibro>{
        if ("id" in obj){
            return validateLibroPersona.indb(obj);
        }else{
            return validateLibroPersona.not_in_db(obj);
        }
    }

    static update(obj: unknown): retrieve<updateLibroPersona>{
        const required = {
            'porcentaje': 'number',
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<updateLibroPersona>(required, obj);
        if (valid.error !== null)
            return valid

        if(!validateLibroPersona.tipoPersona(valid.obj.tipo))
            return {error: `El tipo pasado no es correcto ${Object.keys(TipoPersona)}`, obj: null}

        return {error: null, obj: valid.obj}
    }

    static all<T>(obj: unknown[], validator: Function): T[]{
        let valid_objs: T[] = [];
        for (let o of obj){
            let valid = validator(o);
            if (valid.error !== null)
                throw new ValidationError(valid.error);

            valid_objs.push(valid.obj);
        }
        return valid_objs;
    }

    static remove(obj: unknown): retrieve<removePersonaLibro>{
        const required = {
            'id': 'number',
            'isbn': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<removePersonaLibro>(required, obj);
        if (valid.error !== null)
            return valid

        if(!validateLibroPersona.tipoPersona(valid.obj.tipo))
            return {error: `El tipo pasado no es correcto ${Object.keys(TipoPersona)}`, obj: null}

        return {error: null, obj: valid.obj}
    }
}