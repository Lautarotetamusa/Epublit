import { ValidationError } from '../models/errors';
import { LibroPersona } from '../models/libro_persona.model';
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

        let personas: createPersonaLibro[] = [];

        if ('autores' in obj){
            personas = personas.concat(obj.autores);
        }

        if ('ilustradores' in obj){
            personas = personas.concat(obj.ilustradores);
        }
    
        if (personas.length <= 0){
            throw new ValidationError("Un libro debe tener al menos un autor o un ilustrador");
        }

        for (let o of personas){
            o.isbn = obj.isbn;
            let valid_p = validateLibroPersona.create(o);
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
