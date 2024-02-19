import { 
    UserSchema,
    SaveUser
} from "../schemas/user.schema"
import { BaseModel } from "./base.model";

export class User extends BaseModel{
    username: string;
    password: string;
    id: number;
    cuit: string;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;

    static table_name = "users"; 

    constructor(body: UserSchema){
        super();

        this.username = body.username;
        this.password = body.password;
        this.cond_fiscal = body.cond_fiscal;
        this.cuit = body.cuit;
        this.razon_social = body.razon_social;
        this.domicilio = body.domicilio;
        this.id = body.id;
    }

    static async exists(username: string): Promise<boolean>{
        return await super._exists({username: username});
    }

    static async insert(body: SaveUser): Promise<User>{
        return await this._insert<SaveUser, User>(body);
    }

    static async getAll(): Promise<UserSchema[]>{
        return await super.find_all<UserSchema>();
    }

    static async getOne(username: string): Promise<User>{
        return await super.find_one<UserSchema, User>({username: username})
    }
}
