import {valid_required} from './validate'

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

export class validatePersona {
    static error: string;

    static create(obj: any): obj is createPersona{
        let {valid, error} = valid_required({
            'nombre': 'string',
            'dni': 'string',
        }, obj)
        if (!valid) validatePersona.error = error;

        return valid;
    }
}
