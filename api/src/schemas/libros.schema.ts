import { ValidationError } from '../models/errors';
import { createPersonaLibro, validateLibroPersona } from './libro_persona.schema';
import {validate} from './validate';

export interface retrieveLibro{
    titulo: string,
    isbn: string,
    precio: number,
    fecha_edicion: Date,
    stock: number
}

export interface saveLibro extends retrieveLibro{};

export interface createLibro extends retrieveLibro{
    autores: Array<createPersonaLibro>
    ilustradores: Array<createPersonaLibro>,
}

export interface updateLibro{
    titulo?: string,
    precio?: number,
    fecha_edicion?: Date,
    stock?: number
}

export class validateLibro{
    static create(_obj: any): createLibro{
        const required = {
            'titulo': 'string',
            'isbn': 'string',
            'stock': 'optional?number',
            'precio': 'number',
            'fecha_edicion': 'Date',
            'autores': 'ignore',
            'ilustradores': 'ignore'
        }
        let obj = validate<createLibro>(required, _obj);

        if (!('ilustradores' in obj) && !('autores' in obj)){
            throw new ValidationError("Un libro debe tener al menos un autor o un ilustrador");
        }

        if ('autores' in obj && Array.isArray(obj.autores)){
            for (let o of obj.autores){
                o.isbn = obj.isbn;
                let valid_p = validateLibroPersona.create(o);
            }
        }

        if ('ilustradores' in obj && Array.isArray(obj.ilustradores)){
            for (let o of obj.ilustradores){
                o.isbn = obj.isbn;
                let valid_p = validateLibroPersona.create(o);
            }
        }

        return obj;
    }

    static save(_obj: any): saveLibro{
        const required = {
            'titulo': 'string',
            'isbn': 'string',
            'stock': 'optional?number',
            'precio': 'number',
            'fecha_edicion': 'Date',
        }
        return validate<saveLibro>(required, _obj);
    }

    static update(obj: any): updateLibro{
        const required = {
            'titulo': 'optional?string',
            'isbn': 'optional?string',
            'stock': 'optional?number',
            'precio': 'optional?number',
            'fecha_edicion': 'optional?Date'
        }

        return validate<updateLibro>(required, obj);
    }
}
