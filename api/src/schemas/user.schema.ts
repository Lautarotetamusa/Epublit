import {retrieve, validate} from './validate'

export interface createUser{
    username: string;
    password: string;
}
export interface retrieveUser extends createUser{
    id: number;
}

export class validateUser {
    static error: string;

    static create(obj: any): retrieve<createUser>{
        const required = {
            'username': 'string',
            'password': 'string',
        };

        let valid = validate<createUser>(required, obj);
        return valid;
    }
}
