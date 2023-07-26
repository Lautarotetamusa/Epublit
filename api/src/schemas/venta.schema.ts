import { validate } from "./validate";
import { ValidationError } from "../models/errors";
import { LibroVenta } from "../models/venta.model";
import { Cliente } from "../models/cliente.model";

export enum medio_pago{
    efectivo,
    debito,
    credito,
    mercadopago,
    transferencia
}

interface basic {
    descuento?: number;
    medio_pago: medio_pago;
};

export interface buildVenta extends basic {
    cliente: Cliente,
    libros: LibroVenta[];
    file_path: string;
    total: number;
};

export type libroVenta = {
    cantidad: number,
    isbn: string
};

export type createLibroVenta = {
    cliente: Cliente,
    id: number,
    libros: libroVenta[];
}

export interface saveVenta extends basic {
    file_path: string,
    id_cliente: number,
    total: number;
}

export interface createVenta extends basic {
    cliente: number,
    libros: libroVenta[]
}

export class validateVenta{
    static libroVenta(_obj: any): libroVenta{
        const required = {
            'isbn': 'string',
            'cantidad': 'number'
        }
        let valid = validate<libroVenta>(required, _obj);
        return valid;
    }

    static medioPago(tipo: any): tipo is medio_pago{
        return Object.values(medio_pago).includes(tipo);
    }

    static create(_obj: any): createVenta {
        const required = {
            'cliente': 'number',
            'libros': 'ignore',
            'descuento': 'optional?number',
            'medio_pago': 'ignore'
        }
        let valid = validate<createVenta>(required, _obj);
        
        if (!this.medioPago(valid.medio_pago))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(medio_pago)}`);

        if (!('libros' in _obj))
            throw new ValidationError("Una Venta necesita al menos un libro");

        for (let l of _obj.libros){
            l = this.libroVenta(l);
        }    
        return _obj;
    }
}