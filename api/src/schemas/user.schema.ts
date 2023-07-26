import {validate} from './validate'

export interface createUser{
    username: string;
    password: string;
}
export interface retrieveUser extends createUser{
    id: number;
}

export class validateUser {
    static error: string;

    static create(obj: any): createUser{
        const required = {
            'username': 'string',
            'password': 'string',
        };

        return validate<createUser>(required, obj);
    }
}
