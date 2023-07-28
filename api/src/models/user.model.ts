import { get_afip_data } from "../afip/Afip";
import { 
    retrieveUser, 
    createUser, 
    saveUser 
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

    constructor(_user: retrieveUser){
        super();

        this.username = _user.username;
        this.password = _user.password;
        this.cond_fiscal = _user.cond_fiscal;
        this.cuit = _user.cuit;
        this.razon_social = _user.razon_social;
        this.domicilio = _user.domicilio;
        this.id = _user.id;
    }

    static async exists(username: string): Promise<boolean>{
        return await super._exists({username: username});
    }

    static async insert(_user: createUser): Promise<User>{
        let afip_data = await get_afip_data(_user.cuit);
        return await this._insert<saveUser, User>({
            ..._user,
            ...afip_data,
        });
    }

    static async get_all(): Promise<retrieveUser[]>{
        return await super.find_all<retrieveUser>();
    }

    static async get_one(username: string): Promise<User>{
        return await super.find_one<retrieveUser, User>({username: username})
    }
}
