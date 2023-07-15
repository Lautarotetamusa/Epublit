import { createPersona,  validatePersona } from './persona.schema'
import { retrieve, validate } from './validate'

export enum TipoPersona {
    autor = 0,
    ilustrador
}
export type TipoPersonaString = keyof typeof TipoPersona;

type LibroPersonaPK = {
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

        if(!this.tipoPersona(valid.obj.tipo))
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

        if(!this.tipoPersona(valid.obj.tipo))
            return {error: `El tipo pasado no es correcto ${Object.keys(TipoPersona)}`, obj: null}
        
        let valid_p = validatePersona.create(Object.assign({}, valid.obj));
        if (valid_p.error !== null)
            return valid_p
        
        return {error: null, obj: Object.assign({}, valid.obj, valid_p.obj)}
    }

    static create(obj: any): retrieve<createPersonaLibro>{
        if ("id" in obj){
            return this.indb(obj);
        }else{
            return this.not_in_db(obj);
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

        if(!this.tipoPersona(valid.obj.tipo))
            return {error: `El tipo pasado no es correcto ${Object.keys(TipoPersona)}`, obj: null}

        return {error: null, obj: valid.obj}
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

        if(!this.tipoPersona(valid.obj.tipo))
            return {error: `El tipo pasado no es correcto ${Object.keys(TipoPersona)}`, obj: null}

        return {error: null, obj: valid.obj}
    }
}