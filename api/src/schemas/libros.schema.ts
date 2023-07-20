import { createPersonaLibro, validateLibroPersona } from './libro_persona.schema';
import { retrieve, validate } from './validate';

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
    static create(_obj: any): retrieve<createLibro> {
        const required = {
            'titulo': 'string',
            'isbn': 'string',
            'stock': 'optional?number',
            'precio': 'number',
            'fecha_edicion': 'Date',
            'autores': 'ignore',
            'ilustradores': 'ignore'
        }
        let valid = validate<createLibro>(required, _obj);
        if (valid.error !== null) return {error: valid.error, obj: null}

        let obj = valid.obj;

        if (!('ilustradores' in obj) && !('autores' in obj)){
            return {error: "Un libro debe tener al menos un autor o un ilustrador", obj: null}
        }

        if ('autores' in obj && Array.isArray(obj.autores)){
            for (let o of obj.autores){
                o.isbn = obj.isbn;
                let valid_p = validateLibroPersona.create(o);
                if (valid_p.error !== null)
                    return valid_p
            }
        }

        if ('ilustradores' in obj && Array.isArray(obj.ilustradores)){
            for (let o of obj.ilustradores){
                o.isbn = obj.isbn;
                let valid_p = validateLibroPersona.create(o);
                if (valid_p.error !== null)
                    return valid_p
            }
        }

        return valid;
    }

    static save(_obj: any): retrieve<saveLibro> {
        const required = {
            'titulo': 'string',
            'isbn': 'string',
            'stock': 'optional?number',
            'precio': 'number',
            'fecha_edicion': 'Date',
        }
        return validate<saveLibro>(required, _obj);
    }

    static update(obj: any): retrieve<updateLibro>{
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
