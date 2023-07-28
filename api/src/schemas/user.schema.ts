import { AfipData } from './cliente.schema';
import {validate} from './validate'

interface loginUser {
    username: string;
    password: string;
}

export interface createUser extends loginUser{
    cuit: string;
}

export type saveUser = AfipData & createUser;

export interface retrieveUser extends saveUser{
    id: number;
}

export class validateUser {
    static error: string;

    static create(obj: any): createUser{
        const required = {
            'username': 'string',
            'password': 'string',
            'cuit': 'string'
        };

        return validate<createUser>(required, obj);
    }

    static login(obj: any): loginUser{
        const required = {
            'username': 'string',
            'password': 'string'
        };

        return validate<loginUser>(required, obj);
    }
}
