import {conn} from "../db"
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { ValidationError, NotFound, NothingChanged, Duplicated } from './errors'
import { retrieveUser, createUser } from "../schemas/user.schema"

import { BaseModel } from "./base.model";

export class User extends BaseModel{
    username: string;
    password: string;
    id: number;

    static table_name = "users"; 

    constructor(_user: retrieveUser){
        super();

        this.username = _user.username;
        this.password = _user.password;
        this.id = _user.id;
    }

    static async exists(username: string): Promise<boolean>{
        return await super._exists({username: username});
    }

    static async insert(_user: createUser): Promise<User>{
        return await super._insert<createUser, User>(_user);
    }

    static async get_all(): Promise<retrieveUser[]>{
        return await super.find_all<retrieveUser>();
    }

    static async get_one(username: string): Promise<User>{
        return await super.find_one<retrieveUser, User>({username: username})
    }
}
