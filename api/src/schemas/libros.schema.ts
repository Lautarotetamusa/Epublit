import {createPersona, TipoPersona, validatePersona} from './persona.schema'

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

function valid_required(required: any, obj: any): {valid: boolean, error: string}{
    type keys = keyof typeof required;

    for (let key of Object.keys(required)){
        if (!(key in obj)){ 
            return {valid: false, error: `El ${key} es obligatorio`};
        }
        
        if (required[key as keys] !== "any"){
            if (typeof obj[key] !== required[key as keys]){
                return {valid: false, error: `${key} debe ser de tipo ${required[key as keys]}`};
            }
        }
    }
    return {valid: true, error: ""}
}

export class validateLibroPersona{
    static error: string;

    static tipoPersona(obj: any): obj is TipoPersona{
        if (!('tipo' in obj) && Object.values(TipoPersona).includes(obj.tipo)){
            this.error = "el tipo pasado no es correcto";
            return false
        }
        return true
    }

    static indb(obj: any): obj is createPersonaLibroInDB{
        let {valid, error} = valid_required({
            'porcentaje': 'number',
            'id': 'number',
        }, obj);
        if (!valid)
            this.error = error;
            
        return valid && this.tipoPersona(obj);
    }

    static not_in_db(obj: any): obj is createPersonaLibroNOTInDB{
        let {valid, error} = valid_required({
            'porcentaje': 'number',
        }, obj)
        if (!valid)
            this.error = error;

        if (!validatePersona.create(obj)){
            this.error = validatePersona.error;
            return false
        }

        return valid && this.tipoPersona(obj);
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

export interface createLibro{
    titulo: string,
    isbn: string,
    precio: number,
    fecha_edicion: Date,
    stock: number
    autores: Array<createPersonaLibro>
    ilustradores: Array<createPersonaLibro>,
}
export class validateLibro{
    static error: string;

    static create(obj: any): obj is createLibro {
        let {valid, error} = valid_required({
            'titulo': 'string',
            'isbn': 'string',
            'precio': 'number',
            'fecha_edicion': 'any'
        }, obj)
        if (!valid)
            validateLibro.error = error;

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
}
