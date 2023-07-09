import { ValidationError } from '../models/errors';
import {valid_required, valid_update} from './validate'

export enum TipoPersona {
    autor = 0,
    ilustrador
}
export type TipoPersonaString = keyof typeof TipoPersona;

export interface retrievePersona{
    nombre: string;
    email?: string;
    dni: string;
    id: number;
}

export interface createPersona{
    nombre: string;
    email?: string;
    dni: string;
}

export interface updatePersona{
    nombre?: string;
    email?: string;
    dni?: string;
}

export class validatePersona {
    static error: string;

    static create(_obj: any): {error: string | null, obj: createPersona}{
        const required = {
            'nombre': 'string',
            'dni': 'string',
        }
        let {valid, error} = valid_required(required, _obj)
        if (!valid) error = null;
        return {error: error, obj: _obj}
    }

    static update(obj: any): obj is updatePersona{
        const required = {
            'nombre': 'string',
            'dni': 'string',
            'email': 'string'
        }
        let {valid, error} = valid_update(required, obj);
        if (!valid) this.error = error;
        return valid;
    }
}
