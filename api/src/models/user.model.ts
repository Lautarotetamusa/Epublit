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

    constructor(body: retrieveUser){
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

    static async insert(body: createUser): Promise<User>{
        let afip_data = await get_afip_data(body.cuit);
        return await this._insert<saveUser, User>({
            ...body,
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
