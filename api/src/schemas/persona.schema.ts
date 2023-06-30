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
        const required = {
            'nombre': 'string',
            'dni': 'string',
        }
        type keys = keyof typeof required;

        for (let key of Object.keys(required)){
            if (!(key in obj)){ 
                validatePersona.error = `El ${key} es obligatorio`;
                return false;
            }

            if (typeof obj[key] !== required[key as keys]){
                validatePersona.error = `${key} debe ser de tipo ${required[key as keys]}`;
                return false;
            }
        }
        return true
    }
}