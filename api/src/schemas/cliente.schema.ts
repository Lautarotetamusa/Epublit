import { validate } from "./validate";
import { ValidationError } from "../models/errors";

export enum TipoCliente{
    particular,
    inscripto,
    negro
}

export interface AfipData {
    cond_fiscal: string,
    razon_social: string,
    domicilio: string,
}

export interface saveClienteInscripto extends AfipData{
    nombre: string,
    email?: string,
    cuit: string,
    tipo: TipoCliente
}
export interface retrieveCliente extends saveClienteInscripto{
    id: number
}
export type updateCliente = {
    nombre?: string,
    email?: string,
    cuit?: string,
}

export type createCliente = {
    nombre: string,
    email?: string,
    cuit: string,
    tipo: TipoCliente
}

export type stockCliente = {
    cantidad: number, 
    isbn: string
}[]

export class validateCliente{
    static tipoCliente(tipo: any): tipo is TipoCliente{
        return Object.values(TipoCliente).includes(tipo);
    }

    static create(_obj: any): createCliente {
        const required = {
            'nombre': 'string',
            'email': 'optional?string',
            'cuit': 'string',
            'tipo': 'ignore'
        }
        let valid = validate<createCliente>(required, _obj);

        /*if(!('tipo' in _obj))
            throw new ValidationError("El tipo es obligatorio");
        
        if(!validateCliente.tipoCliente(valid.tipo))
            throw new ValidationError(`El tipo pasado no es correcto ${Object.keys(TipoCliente)}`);
            
        if(_obj.tipo != TipoCliente.inscripto)
            throw new ValidationError(`No se puede crear un cliente de tipo ${String(_obj.tipo)}`);*/

        return valid;
    }

    static update(_obj: any): updateCliente{
        const required = {
            'nombre': 'optional?string',
            'email': 'optional?string',
            'cuit': 'optional?string'
        }
        return validate<updateCliente>(required, _obj);
    }
}