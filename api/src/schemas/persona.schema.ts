import {validate} from './validate'

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
    static create(_obj: any): createPersona {
        const required = {
            'nombre': 'string',
            'email': 'optional?string',
            'dni': 'string',
        }
        return validate<createPersona>(required, _obj);
    }

    static update(obj: any): updatePersona{
        const required = {
            'nombre': 'optional?string',
            'dni': 'optional?string',
            'email': 'optional?string'
        }
        return validate<updatePersona>(required, obj);
    }
}
