import {createPersona, TipoPersona, validatePersona} from './persona.schema'
import {valid_required, valid_update} from './validate'

export interface createPersonaLibroInDB{
    porcentaje: number;
    tipo: TipoPersona;
    id: number;
}
export interface createPersonaLibroNOTInDB extends createPersona{
    porcentaje: number;
    tipo: TipoPersona;
}
type createPersonaLibro = createPersonaLibroInDB | createPersonaLibroNOTInDB;

export class validateLibroPersona{
    static error: string;

    static tipoPersona(obj: any): obj is TipoPersona{
        if (!('tipo' in obj) && Object.values(TipoPersona).includes(obj.tipo)){
            this.error = "El tipo pasado no es correcto";
            return false
        }
        return true
    }

    static indb(obj: any): obj is createPersonaLibroInDB{
        const required = {
            'porcentaje': 'number',
            'id': 'number',
        }
        let valid_tipo = this.tipoPersona(obj);

        let {valid, error} = valid_required(required, obj);
        if (!valid) this.error = error;
        return valid && valid_tipo;
    }

    static not_in_db(obj: any): obj is createPersonaLibroNOTInDB{
        const required = {
            'porcentaje': 'number',
        }
        let valid_tipo = this.tipoPersona(obj);

        let {valid, error} = valid_required(required, obj)
        if (!valid) this.error = error;

        if (!validatePersona.create(obj)){
            this.error = validatePersona.error;
            return false
        }

        return valid && valid_tipo;
    }

    static create(obj: any): obj is createPersonaLibro{
        if ("id" in obj){
            return validateLibroPersona.indb(obj)
        }else{
            return validateLibroPersona.not_in_db(obj)
        }
    }
}

export interface retrieveLibro{
    titulo: string,
    isbn: string,
    precio: number,
    fecha_edicion: Date,
    stock: number
}

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
    static error: string;

    static create(obj: any): obj is createLibro {
        const required = {
            'titulo': 'string',
            'isbn': 'string',
            'precio': 'number',
            'fecha_edicion': 'Date'
        }
        let {valid, error} = valid_required(required, obj);
        if (!valid) validateLibro.error = error;

        if (!('ilustradores' in obj) && !('autores' in obj)){
            validateLibro.error = "Un libro debe tener al menos un autor o un ilustrador";
            return false;
        }

        if ('autores' in obj && Array.isArray(obj.autores)){
            if(!obj.autores.every(validateLibroPersona.create)){
                validateLibro.error = validateLibroPersona.error;
                return false;
            }
        }

        if ('ilustradores' in obj && Array.isArray(obj.ilustradores)){
            if(!obj.ilustradores.every(validateLibroPersona.create)){
                validateLibro.error = validateLibroPersona.error;
                return false;
            }
        }

        return valid;
    }

    static update(obj: any): obj is updateLibro{
        const required = {
            'titulo': 'string',
            'isbn': 'string',
            'precio': 'number',
            'fecha_edicion': 'Date'
        }

        let {valid, error} = valid_update(required, obj);
        if (!valid) this.error = error;
        return valid;
    }
}
