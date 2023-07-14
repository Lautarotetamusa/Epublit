import {valid_required} from './validate'

export interface createUser{
    username: string;
    password: string;
}
export interface retrieveUser extends createUser{
    id: number;
}

export class validateUser {
    static error: string;

    static create(obj: any): obj is createUser{
        let {valid, error} = valid_required({
            'username': 'string',
            'password': 'string',
        }, obj)
        if (!valid) validateUser.error = error;

        return valid;
    }
}
