import { LibroConsignacion } from "../models/consignacion.model";
import { validate } from "./validate";
import { ValidationError } from "../models/errors";

export type buildConsignacion = {
    cliente: any,
    libros: LibroConsignacion[];
    file_path: string;
}

export type createLibroConsignacion = {
    cliente: any,
    id: number,
    libros: {
        cantidad: number,
        isbn: string
    }[]
}

export type saveConsignacion = {
    remito_path: string;
    id_cliente: number;
}

export type createConsignacion = {
    cliente: number,
    libros: {
        cantidad: number,
        isbn: string
    }[]
}
export class validateConsignacion{
    static libroConsignacion(_obj: any): {isbn: string, cantidad: number}{
        const required = {
            'isbn': 'string',
            'cantidad': 'number'
        }
        let valid = validate<{isbn: string, cantidad: number}>(required, _obj);
        if (valid.error !== null)
            throw new ValidationError(valid.error);

        return valid.obj;
    }

    static create(_obj: any): createConsignacion {
        const required = {
            'cliente': 'number',
            'libros': 'ignore'
        }
        let valid = validate<createConsignacion>(required, _obj);
        if (valid.error !== null)
            throw new ValidationError(valid.error);

        if (!('libros' in _obj))
            throw new ValidationError("Una consignacion necesita al menos un libro");

        for (let l of _obj.libros){
            l = this.libroConsignacion(l);
        }    
        return _obj;
    }
}